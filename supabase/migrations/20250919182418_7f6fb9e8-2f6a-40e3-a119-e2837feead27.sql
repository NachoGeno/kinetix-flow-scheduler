-- ===============================================
-- 1. ÍNDICE ÚNICO PARCIAL PARA PREVENIR DUPLICADOS
-- ===============================================
-- Evita que se creen turnos duplicados (mismo paciente, doctor, fecha, hora) con estados activos
CREATE UNIQUE INDEX CONCURRENTLY idx_appointments_unique_active
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

-- ===============================================
-- 3. FUNCIÓN DE REMEDIACIÓN DE DUPLICADOS
-- ===============================================
-- Detecta y repara turnos duplicados existentes
CREATE OR REPLACE FUNCTION public.remediate_duplicate_appointments()
RETURNS TABLE(
    patient_name text,
    doctor_name text,
    appointment_date date,
    appointment_time time,
    duplicates_found integer,
    oldest_kept_id uuid,
    cancelled_ids uuid[]
)
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    duplicate_group RECORD;
    appointment_ids uuid[];
    kept_appointment_id uuid;
    cancelled_appointment_ids uuid[];
BEGIN
    -- Buscar grupos de turnos duplicados activos
    FOR duplicate_group IN
        SELECT 
            a.doctor_id,
            a.appointment_date, 
            a.appointment_time,
            a.patient_id,
            a.organization_id,
            array_agg(a.id ORDER BY a.created_at ASC) as ids,
            COUNT(*) as duplicate_count,
            CONCAT(pp.first_name, ' ', pp.last_name) as patient_full_name,
            CONCAT(dp.first_name, ' ', dp.last_name) as doctor_full_name
        FROM appointments a
        JOIN patients pt ON a.patient_id = pt.id
        JOIN profiles pp ON pt.profile_id = pp.id  
        JOIN doctors d ON a.doctor_id = d.id
        JOIN profiles dp ON d.profile_id = dp.id
        WHERE a.status IN ('scheduled', 'confirmed', 'in_progress')
        GROUP BY a.doctor_id, a.appointment_date, a.appointment_time, a.patient_id, a.organization_id,
                 pp.first_name, pp.last_name, dp.first_name, dp.last_name
        HAVING COUNT(*) > 1
    LOOP
        appointment_ids := duplicate_group.ids;
        kept_appointment_id := appointment_ids[1]; -- Mantener el más antiguo
        cancelled_appointment_ids := appointment_ids[2:]; -- Cancelar el resto
        
        -- Cancelar los duplicados (excepto el más antiguo)
        UPDATE appointments 
        SET 
            status = 'cancelled',
            notes = COALESCE(notes || ' ', '') || '[AUTO-CANCELADO: Duplicado detectado y reparado]',
            updated_at = NOW()
        WHERE id = ANY(cancelled_appointment_ids);
        
        -- Mover las asignaciones de órdenes médicas de los cancelados al que se mantiene
        UPDATE appointment_order_assignments
        SET appointment_id = kept_appointment_id
        WHERE appointment_id = ANY(cancelled_appointment_ids)
        AND NOT EXISTS (
            SELECT 1 FROM appointment_order_assignments aoa2 
            WHERE aoa2.appointment_id = kept_appointment_id 
            AND aoa2.medical_order_id = appointment_order_assignments.medical_order_id
        );
        
        -- Eliminar asignaciones duplicadas que no se pudieron mover
        DELETE FROM appointment_order_assignments
        WHERE appointment_id = ANY(cancelled_appointment_ids);
        
        -- Devolver información del grupo procesado
        RETURN QUERY SELECT 
            duplicate_group.patient_full_name,
            duplicate_group.doctor_full_name,
            duplicate_group.appointment_date,
            duplicate_group.appointment_time,
            duplicate_group.duplicate_count::integer,
            kept_appointment_id,
            cancelled_appointment_ids;
    END LOOP;
    
    RETURN;
END;
$$;

-- ===============================================
-- 4. AJUSTAR TRIGGER DE VALIDACIÓN DE FECHAS
-- ===============================================
-- Remover la autocorrección automática, solo validar
CREATE OR REPLACE FUNCTION public.validate_appointment_date()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- For INSERT operations, always validate the date
  IF TG_OP = 'INSERT' THEN
    -- Guardrail: reject obviously wrong dates (over 1 year away)
    IF ABS(NEW.appointment_date - CURRENT_DATE) > 365 THEN
      RAISE EXCEPTION 'Fecha de cita inválida: % está muy lejos de la fecha actual', NEW.appointment_date;
    END IF;

    -- Log suspicious dates but don't auto-correct (removed auto-correction)
    IF NEW.appointment_date::date - CURRENT_DATE = 10 AND 
       CURRENT_TIME BETWEEN '08:00'::time AND '22:00'::time THEN
      RAISE NOTICE 'Fecha sospechosa detectada (+10 días): % para cita %', NEW.appointment_date, NEW.id;
    END IF;
  END IF;

  -- For UPDATE operations, only validate if appointment_date is actually changing  
  IF TG_OP = 'UPDATE' AND OLD.appointment_date IS DISTINCT FROM NEW.appointment_date THEN
    -- Guardrail: reject obviously wrong dates (over 1 year away)
    IF ABS(NEW.appointment_date - CURRENT_DATE) > 365 THEN
      RAISE EXCEPTION 'Fecha de cita inválida: % está muy lejos de la fecha actual', NEW.appointment_date;
    END IF;

    -- Log suspicious dates but don't auto-correct
    IF NEW.appointment_date::date - CURRENT_DATE = 10 AND 
       CURRENT_TIME BETWEEN '08:00'::time AND '22:00'::time THEN
      RAISE NOTICE 'Fecha sospechosa detectada en actualización (+10 días): % para cita %', NEW.appointment_date, NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ===============================================
-- 5. EJECUTAR REMEDIACIÓN DE DUPLICADOS EXISTENTES
-- ===============================================
-- Ejecutar la función para limpiar duplicados existentes
SELECT 
    patient_name,
    doctor_name, 
    appointment_date,
    appointment_time,
    duplicates_found,
    oldest_kept_id,
    array_length(cancelled_ids, 1) as cancelled_count
FROM remediate_duplicate_appointments()
ORDER BY appointment_date DESC, appointment_time ASC;