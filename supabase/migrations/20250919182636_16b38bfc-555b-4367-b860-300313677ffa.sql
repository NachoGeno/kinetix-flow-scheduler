-- ===============================================
-- 1. ÍNDICE ÚNICO PARCIAL PARA PREVENIR DUPLICADOS
-- ===============================================
-- Evita que se creen turnos duplicados (mismo paciente, doctor, fecha, hora) con estados activos
CREATE UNIQUE INDEX idx_appointments_unique_active
ON appointments (doctor_id, appointment_date, appointment_time, patient_id, organization_id)
WHERE status IN ('scheduled', 'confirmed', 'in_progress');

-- ===============================================
-- 2. RPC TRANSACCIONAL PARA CREAR Y ASIGNAR TURNOS
-- ===============================================
-- Función que crea turnos y los asigna a una orden médica atómicamente
CREATE OR REPLACE FUNCTION public.create_appointments_with_order(
    appointments_data jsonb,  -- Array de objetos con datos de citas
    medical_order_id_param uuid DEFAULT NULL,
    assigned_by_param uuid DEFAULT NULL
) RETURNS TABLE(
    appointment_id uuid,
    was_created boolean,
    conflict_reason text
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    appointment_record jsonb;
    created_appointment_id uuid;
    assignment_exists boolean;
    current_user_org_id uuid;
BEGIN
    -- Get current user organization
    SELECT organization_id INTO current_user_org_id 
    FROM profiles 
    WHERE user_id = auth.uid();
    
    IF current_user_org_id IS NULL THEN
        RAISE EXCEPTION 'User organization not found';
    END IF;

    -- Validar capacidad de la orden médica si se proporciona
    IF medical_order_id_param IS NOT NULL THEN
        DECLARE
            total_appointments_count integer;
            can_assign_result boolean;
        BEGIN
            SELECT jsonb_array_length(appointments_data) INTO total_appointments_count;
            
            SELECT validate_appointment_assignment_capacity(
                medical_order_id_param, 
                total_appointments_count
            ) INTO can_assign_result;
            
            IF NOT can_assign_result THEN
                RAISE EXCEPTION 'Orden médica sin capacidad suficiente para % turnos', total_appointments_count;
            END IF;
        END;
    END IF;

    -- Procesar cada cita del array
    FOR appointment_record IN SELECT * FROM jsonb_array_elements(appointments_data)
    LOOP
        BEGIN
            -- Intentar crear la cita con ON CONFLICT DO NOTHING
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
            ON CONFLICT ON CONSTRAINT idx_appointments_unique_active DO NOTHING
            RETURNING id INTO created_appointment_id;

            IF created_appointment_id IS NOT NULL THEN
                -- Cita creada exitosamente
                
                -- Si hay orden médica, crear la asignación
                IF medical_order_id_param IS NOT NULL THEN
                    -- Verificar que no existe ya la asignación (por si acaso)
                    SELECT EXISTS(
                        SELECT 1 FROM appointment_order_assignments 
                        WHERE appointment_id = created_appointment_id
                    ) INTO assignment_exists;
                    
                    IF NOT assignment_exists THEN
                        INSERT INTO appointment_order_assignments (
                            appointment_id,
                            medical_order_id,
                            assigned_by
                        ) VALUES (
                            created_appointment_id,
                            medical_order_id_param,
                            assigned_by_param
                        );
                    END IF;
                END IF;

                -- Devolver éxito
                RETURN QUERY SELECT created_appointment_id, true, NULL::text;
            ELSE
                -- La cita ya existía (conflicto con el índice único)
                RETURN QUERY SELECT NULL::uuid, false, 'Cita duplicada detectada y omitida'::text;
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                -- Error inesperado
                RETURN QUERY SELECT NULL::uuid, false, ('Error: ' || SQLERRM)::text;
        END;
    END LOOP;
END;
$$;