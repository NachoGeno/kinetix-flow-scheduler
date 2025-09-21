-- Fix ambiguous column reference in create_appointments_with_order function
CREATE OR REPLACE FUNCTION public.create_appointments_with_order(appointments_data jsonb, medical_order_id_param uuid DEFAULT NULL::uuid, assigned_by_param uuid DEFAULT NULL::uuid, organization_id_param uuid DEFAULT NULL::uuid)
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
    v_patient_id uuid;
    v_doctor_id uuid;
    v_date date;
    v_time time;
    v_reason text;
    v_status appointment_status;
    v_notes text;
    v_duration integer;
BEGIN
    -- Set session flag to prevent auto-assignment conflicts
    PERFORM set_config('app.skip_auto_assign', 'true', true);

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
            -- Extract values safely
            v_patient_id := (appointment_record->>'patient_id')::uuid;
            v_doctor_id := (appointment_record->>'doctor_id')::uuid;
            v_date := (appointment_record->>'appointment_date')::date;
            v_time := (appointment_record->>'appointment_time')::time;
            v_reason := appointment_record->>'reason';
            v_status := COALESCE(appointment_record->>'status', 'scheduled')::appointment_status;
            v_notes := appointment_record->>'notes';
            v_duration := COALESCE((appointment_record->>'duration_minutes')::integer, 30);

            -- Explicit duplicate check compatible with partial unique index
            IF EXISTS (
                SELECT 1 FROM appointments a
                WHERE a.patient_id = v_patient_id
                  AND a.doctor_id = v_doctor_id
                  AND a.appointment_date = v_date
                  AND a.appointment_time = v_time
                  AND a.organization_id = current_user_org_id
                  AND a.status IN ('scheduled','confirmed','in_progress')
            ) THEN
                -- Appointment already existed
                RETURN QUERY SELECT NULL::uuid, false, 'Cita duplicada detectada y omitida'::text;
            ELSE
                -- Create appointment
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
                    v_patient_id,
                    v_doctor_id,
                    v_date,
                    v_time,
                    v_reason,
                    v_status,
                    v_notes,
                    current_user_org_id,
                    v_duration
                )
                RETURNING id INTO created_appointment_id;

                -- Handle appointment_order_assignments with UPSERT to prevent conflicts
                -- First delete any existing assignment for this appointment - FIX: qualify the column reference
                DELETE FROM appointment_order_assignments aoa
                WHERE aoa.appointment_id = created_appointment_id;

                -- Then insert the explicit assignment
                INSERT INTO appointment_order_assignments (
                    appointment_id,
                    medical_order_id,
                    assigned_by
                ) VALUES (
                    created_appointment_id,
                    medical_order_id_param,
                    assigned_by_param
                );

                -- Recalculate sessions for the order
                PERFORM recalc_order_sessions(medical_order_id_param);

                RAISE NOTICE 'AUDIT_LOG: Appointment % created and assigned to order % (org %)', 
                             created_appointment_id, medical_order_id_param, current_user_org_id;

                RETURN QUERY SELECT created_appointment_id, true, NULL::text;
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'AUDIT_LOG: ERROR creating appointment: %', SQLERRM;
                RETURN QUERY SELECT NULL::uuid, false, ('Error: ' || SQLERRM)::text;
        END;
    END LOOP;

    -- Reset session flag
    PERFORM set_config('app.skip_auto_assign', 'false', true);
END;
$function$;