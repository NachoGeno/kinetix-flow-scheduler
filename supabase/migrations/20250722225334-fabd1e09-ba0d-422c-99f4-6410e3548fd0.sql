-- Función para generar manualmente el resumen final de órdenes ya completadas
CREATE OR REPLACE FUNCTION public.generate_final_summary_for_completed_order(order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_medical_order medical_orders%ROWTYPE;
    v_unified_history_id UUID;
    v_final_summary JSONB;
BEGIN
    -- Obtener la orden médica
    SELECT * INTO v_medical_order
    FROM medical_orders
    WHERE id = order_id AND completed = true;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Orden médica % no encontrada o no completada', order_id;
        RETURN FALSE;
    END IF;
    
    -- Verificar si ya existe una historia unificada
    SELECT id INTO v_unified_history_id
    FROM unified_medical_histories
    WHERE medical_order_id = order_id;
    
    -- Si no existe, crearla
    IF v_unified_history_id IS NULL THEN
        INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data)
        VALUES (order_id, v_medical_order.patient_id, '{}')
        RETURNING id INTO v_unified_history_id;
        
        RAISE NOTICE 'Historia unificada creada para orden %', order_id;
    END IF;
    
    -- Verificar si ya tiene resumen final
    SELECT template_data->'final_summary' INTO v_final_summary
    FROM unified_medical_histories
    WHERE id = v_unified_history_id;
    
    -- Si no tiene resumen final, generarlo
    IF v_final_summary IS NULL OR v_final_summary = 'null'::jsonb THEN
        v_final_summary := jsonb_build_object(
            'final_summary', jsonb_build_object(
                'total_sessions_completed', v_medical_order.sessions_used,
                'completion_date', COALESCE(v_medical_order.completed_at, NOW()),
                'summary', 'Tratamiento completado según orden médica. Todas las sesiones han sido realizadas.',
                'recommendations', 'Seguimiento según indicación médica.',
                'generated_automatically', true,
                'generated_manually', true
            )
        );
        
        -- Actualizar la historia unificada
        UPDATE unified_medical_histories
        SET template_data = COALESCE(template_data, '{}'::jsonb) || v_final_summary,
            updated_at = NOW()
        WHERE id = v_unified_history_id;
        
        RAISE NOTICE 'Resumen final generado para orden % con % sesiones', order_id, v_medical_order.sessions_used;
        RETURN TRUE;
    ELSE
        RAISE NOTICE 'La orden % ya tiene resumen final', order_id;
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Ejecutar la función para las órdenes completadas de balta genovese
SELECT public.generate_final_summary_for_completed_order('7029f499-1490-4341-8fcd-8d6ec14d48ba');
SELECT public.generate_final_summary_for_completed_order('b12012de-3178-4260-9047-7b35c92fa6cc');