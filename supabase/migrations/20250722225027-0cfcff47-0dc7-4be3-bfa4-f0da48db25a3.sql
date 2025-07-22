-- Crear trigger también para cuando se completa una orden médica manualmente
CREATE OR REPLACE FUNCTION public.auto_generate_final_summary_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_unified_history_id UUID;
    v_final_summary JSONB;
    v_completed_sessions INTEGER;
BEGIN
    -- Solo procesar si la orden médica se está marcando como completada
    IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
        
        -- Contar sesiones completadas para este paciente
        SELECT COUNT(*)
        INTO v_completed_sessions
        FROM appointments a
        WHERE a.patient_id = NEW.patient_id
        AND a.status = 'completed';
        
        -- Si no hay sesiones completadas pero la orden se marca como completada manualmente,
        -- usar sessions_used de la orden médica
        IF v_completed_sessions = 0 AND NEW.sessions_used > 0 THEN
            v_completed_sessions := NEW.sessions_used;
        END IF;
        
        -- Obtener o crear unified_medical_history
        SELECT id INTO v_unified_history_id
        FROM unified_medical_histories
        WHERE medical_order_id = NEW.id;
        
        IF v_unified_history_id IS NULL THEN
            INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data)
            VALUES (NEW.id, NEW.patient_id, '{}')
            RETURNING id INTO v_unified_history_id;
        END IF;
        
        -- Generar el resumen final automáticamente
        v_final_summary := jsonb_build_object(
            'final_summary', jsonb_build_object(
                'total_sessions_completed', v_completed_sessions,
                'completion_date', NOW(),
                'summary', 'Tratamiento completado según orden médica. Todas las sesiones han sido realizadas.',
                'recommendations', 'Seguimiento según indicación médica.',
                'generated_automatically', true,
                'completed_manually', true
            )
        );
        
        -- Actualizar la unified_medical_history con el resumen final
        UPDATE unified_medical_histories
        SET template_data = COALESCE(template_data, '{}'::jsonb) || v_final_summary,
            updated_at = NOW()
        WHERE id = v_unified_history_id;
        
        RAISE NOTICE 'Resumen final generado automáticamente para orden médica completada manualmente %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Crear trigger para ejecutar la función cuando se actualice una orden médica
CREATE TRIGGER trigger_auto_generate_final_summary_on_order
    AFTER UPDATE ON medical_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_final_summary_on_order_completion();