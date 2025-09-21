-- Fix create_appointments_with_order to use column-based ON CONFLICT for partial unique index inference
CREATE OR REPLACE FUNCTION public.create_appointments_with_order(
  appointments_data jsonb,
  medical_order_id_param uuid DEFAULT NULL::uuid,
  assigned_by_param uuid DEFAULT NULL::uuid,
  organization_id_param uuid DEFAULT NULL::uuid
)
RETURNS TABLE(appointment_id uuid, was_created boolean, conflict_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    appointment_record jsonb;
    created_appointment_id uuid;
    current_user_org_id uuid;
    total_appointments_count integer;
    validation_result jsonb;
BEGIN
    -- Try to get organization from current user profile
    SELECT organization_id INTO current_user_org_id 
    FROM profiles 
    WHERE user_id = auth.uid();

    -- Fallback to explicit parameter if not found via auth
    IF current_user_org_id IS NULL THEN
        current_user_org_id := organization_id_param;
    END IF;

    -- Final validation for organization
    IF current_user_org_id IS NULL THEN
        RAISE EXCEPTION 'User organization not found. Provide organization_id_param.';
    END IF;

    -- CRITICAL VALIDATION: Medical order is REQUIRED
    IF medical_order_id_param IS NULL THEN
        RAISE EXCEPTION 'ORDEN_REQUERIDA: Todos los turnos deben tener una orden médica asignada';
    END IF;

    -- Count appointments to create
    SELECT jsonb_array_length(appointments_data) INTO total_appointments_count;

    -- STRICT VALIDATION: Verify order capacity
    SELECT validate_order_assignment_capacity(
        medical_order_id_param, 
        total_appointments_count
    ) INTO validation_result;

    IF NOT (validation_result->>'valid')::boolean THEN
        RAISE EXCEPTION 'VALIDACION_FALLIDA: %', validation_result->>'message';
    END IF;

    -- Audit log
    RAISE NOTICE 'AUDIT_LOG: Creating % appointments for order % by % in org %', 
                 total_appointments_count, medical_order_id_param, assigned_by_param, current_user_org_id;

    -- Process each appointment in the array
    FOR appointment_record IN SELECT * FROM jsonb_array_elements(appointments_data)
    LOOP
        BEGIN
            -- Try to create appointment with correct ON CONFLICT inference (works with partial unique index)
            INSERT INTO appointments (
                patient_id,
                doctor_id, 
                appointment_date,
                appointment_time,
                reason,
                status,
                notes,
                organization_id,
                duration_minutes
            ) VALUES (
                (appointment_record->>'patient_id')::uuid,
                (appointment_record->>'doctor_id')::uuid,
                (appointment_record->>'appointment_date')::date,
                (appointment_record->>'appointment_time')::time,
                appointment_record->>'reason',
                COALESCE(appointment_record->>'status', 'scheduled')::appointment_status,
                appointment_record->>'notes',
                current_user_org_id,
                COALESCE((appointment_record->>'duration_minutes')::integer, 30)
            )
            ON CONFLICT (doctor_id, appointment_date, appointment_time, patient_id, organization_id) DO NOTHING
            RETURNING id INTO created_appointment_id;

            IF created_appointment_id IS NOT NULL THEN
                -- Appointment created successfully
                INSERT INTO appointment_order_assignments (
                    appointment_id,
                    medical_order_id,
                    assigned_by
                ) VALUES (
                    created_appointment_id,
                    medical_order_id_param,
                    assigned_by_param
                );

                RAISE NOTICE 'AUDIT_LOG: Appointment % created and assigned to order % (org %)', 
                             created_appointment_id, medical_order_id_param, current_user_org_id;

                RETURN QUERY SELECT created_appointment_id, true, NULL::text;
            ELSE
                -- Appointment already existed
                RETURN QUERY SELECT NULL::uuid, false, 'Cita duplicada detectada y omitida'::text;
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'AUDIT_LOG: ERROR creating appointment: %', SQLERRM;
                RETURN QUERY SELECT NULL::uuid, false, ('Error: ' || SQLERRM)::text;
        END;
    END LOOP;
END;
$function$;