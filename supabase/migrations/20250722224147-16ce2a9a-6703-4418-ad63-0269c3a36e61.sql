-- Corregir el search_path de la función recién creada
CREATE OR REPLACE FUNCTION public.auto_generate_final_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_medical_order_id UUID;
    v_total_sessions INTEGER;
    v_completed_sessions INTEGER;
    v_unified_history_id UUID;
    v_final_summary JSONB;
BEGIN
    -- Solo procesar si el appointment se está marcando como completado
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Buscar la orden médica asociada al paciente
        SELECT mo.id, mo.total_sessions 
        INTO v_medical_order_id, v_total_sessions
        FROM medical_orders mo
        WHERE mo.patient_id = NEW.patient_id
        AND mo.completed = false
        ORDER BY mo.created_at DESC
        LIMIT 1;
        
        IF v_medical_order_id IS NOT NULL THEN
            -- Contar sesiones completadas para esta orden médica
            SELECT COUNT(*)
            INTO v_completed_sessions
            FROM appointments a
            WHERE a.patient_id = NEW.patient_id
            AND a.status = 'completed';
            
            -- Si se completaron todas las sesiones requeridas
            IF v_completed_sessions >= v_total_sessions THEN
                
                -- Obtener o crear unified_medical_history
                SELECT id INTO v_unified_history_id
                FROM unified_medical_histories
                WHERE medical_order_id = v_medical_order_id;
                
                IF v_unified_history_id IS NULL THEN
                    INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data)
                    VALUES (v_medical_order_id, NEW.patient_id, '{}')
                    RETURNING id INTO v_unified_history_id;
                END IF;
                
                -- Generar el resumen final automáticamente
                v_final_summary := jsonb_build_object(
                    'final_summary', jsonb_build_object(
                        'total_sessions_completed', v_completed_sessions,
                        'completion_date', NOW(),
                        'summary', 'Tratamiento completado según orden médica. Todas las sesiones han sido realizadas.',
                        'recommendations', 'Seguimiento según indicación médica.',
                        'generated_automatically', true
                    )
                );
                
                -- Actualizar la unified_medical_history con el resumen final
                UPDATE unified_medical_histories
                SET template_data = COALESCE(template_data, '{}'::jsonb) || v_final_summary,
                    updated_at = NOW()
                WHERE id = v_unified_history_id;
                
                -- Marcar la orden médica como completada
                UPDATE medical_orders
                SET completed = true,
                    completed_at = NOW(),
                    sessions_used = v_completed_sessions
                WHERE id = v_medical_order_id;
                
                RAISE NOTICE 'Resumen final generado automáticamente para orden médica %', v_medical_order_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';