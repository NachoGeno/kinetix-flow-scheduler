-- 1) Reforzar manejo de asistencia: asegurar asignación y recalcular sesiones
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Procesar cuando cambia a 'completed' o 'in_progress'
    IF NEW.status IN ('completed', 'in_progress') AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'in_progress')) THEN
        -- Si la cita no está asignada a una orden, intentar asignarla a la más antigua con cupo
        IF NOT EXISTS (
            SELECT 1 FROM appointment_order_assignments WHERE appointment_id = NEW.id
        ) THEN
            PERFORM assign_appointment_to_oldest_available_order(NEW.patient_id, NEW.id);
        END IF;

        -- Recalcular sesiones de todas las órdenes del paciente (mantiene integridad)
        PERFORM recalc_patient_order_sessions_with_assignments(NEW.patient_id);
    END IF;

    RETURN NEW;
END;
$$;

-- 2) Evitar que auto_generate_final_summary fuerce sessions_used y rompa integridad
CREATE OR REPLACE FUNCTION public.auto_generate_final_summary()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_medical_order_id UUID;
    v_total_sessions INTEGER;
    v_completed_sessions INTEGER;
    v_unified_history_id UUID;
    v_final_summary JSONB;
BEGIN
    -- Solo procesar si el appointment se está marcando como completado
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Buscar la orden médica asociada al paciente (activa más reciente)
        SELECT mo.id, mo.total_sessions 
        INTO v_medical_order_id, v_total_sessions
        FROM medical_orders mo
        WHERE mo.patient_id = NEW.patient_id
          AND mo.completed = false
        ORDER BY mo.created_at DESC
        LIMIT 1;

        IF v_medical_order_id IS NOT NULL THEN
            -- Contar sesiones completadas para este paciente desde la creación de esa orden
            WITH order_creation_date AS (
                SELECT created_at::date as order_date 
                FROM medical_orders 
                WHERE id = v_medical_order_id
            )
            SELECT COUNT(*)
            INTO v_completed_sessions
            FROM appointments a
            CROSS JOIN order_creation_date ocd
            WHERE a.patient_id = NEW.patient_id
              AND a.status = 'completed'
              AND a.appointment_date >= ocd.order_date;

            -- Obtener o crear unified_medical_history
            SELECT id INTO v_unified_history_id
            FROM unified_medical_histories
            WHERE medical_order_id = v_medical_order_id;
            
            IF v_unified_history_id IS NULL THEN
                INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data, organization_id)
                VALUES (v_medical_order_id, NEW.patient_id, '{}', NEW.organization_id)
                RETURNING id INTO v_unified_history_id;
            END IF;

            -- Si ya se completaron las sesiones requeridas, generar resumen final (no tocar sessions_used aquí)
            IF v_completed_sessions >= v_total_sessions THEN
                v_final_summary := jsonb_build_object(
                    'final_summary', jsonb_build_object(
                        'total_sessions_completed', v_completed_sessions,
                        'completion_date', NOW(),
                        'summary', 'Tratamiento completado según orden médica. Todas las sesiones han sido realizadas.',
                        'recommendations', 'Seguimiento según indicación médica.',
                        'generated_automatically', true
                    )
                );

                UPDATE unified_medical_histories
                SET template_data = COALESCE(template_data, '{}'::jsonb) || v_final_summary,
                    updated_at = NOW()
                WHERE id = v_unified_history_id;
            END IF;

            -- REGLA CLAVE: recalcular sesiones por asignaciones y cerrar orden si corresponde
            PERFORM recalc_order_sessions(v_medical_order_id);
            UPDATE medical_orders
            SET 
                completed = (sessions_used >= total_sessions),
                completed_at = CASE WHEN sessions_used >= total_sessions AND completed_at IS NULL THEN NOW() ELSE completed_at END
            WHERE id = v_medical_order_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;