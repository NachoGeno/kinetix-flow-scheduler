-- Fix the auto_generate_final_summary trigger to count sessions per specific medical order
CREATE OR REPLACE FUNCTION public.auto_generate_final_summary()
RETURNS trigger
LANGUAGE plpgsql AS $$
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
            -- CORREGIDO: Contar solo sesiones completadas DESPUÉS de la creación de esta orden médica específica
            -- y que no estén ya contabilizadas en otras órdenes médicas completadas
            WITH order_creation_date AS (
                SELECT created_at::date as order_date 
                FROM medical_orders 
                WHERE id = v_medical_order_id
            ),
            other_completed_orders AS (
                SELECT mo.id, mo.created_at::date as order_date, mo.sessions_used
                FROM medical_orders mo
                WHERE mo.patient_id = NEW.patient_id 
                AND mo.completed = true 
                AND mo.id != v_medical_order_id
                ORDER BY mo.created_at
            )
            SELECT COUNT(*)
            INTO v_completed_sessions
            FROM appointments a
            CROSS JOIN order_creation_date ocd
            WHERE a.patient_id = NEW.patient_id
            AND a.status = 'completed'
            AND a.appointment_date >= ocd.order_date
            -- Excluir sesiones ya contabilizadas en órdenes médicas completadas anteriores
            AND NOT EXISTS (
                SELECT 1 FROM other_completed_orders oco
                WHERE a.appointment_date < ocd.order_date 
                AND a.appointment_date >= oco.order_date
            );
            
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
            ELSE
                -- Solo actualizar el contador de sesiones usadas sin completar la orden
                UPDATE medical_orders
                SET sessions_used = v_completed_sessions,
                    updated_at = NOW()
                WHERE id = v_medical_order_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Ejecutar la función de corrección de integridad de datos
SELECT * FROM fix_medical_orders_data_integrity();

-- Verificar las órdenes médicas de Hugo García después de la corrección
SELECT 
    mo.id,
    CONCAT(pr.first_name, ' ', pr.last_name) as patient_name,
    mo.description,
    mo.total_sessions,
    mo.sessions_used,
    mo.completed,
    mo.created_at,
    get_real_session_count(mo.patient_id) as real_sessions
FROM medical_orders mo
JOIN patients p ON mo.patient_id = p.id
JOIN profiles pr ON p.profile_id = pr.id
WHERE pr.first_name ILIKE '%Hugo%' AND pr.last_name ILIKE '%Garcia%'
ORDER BY mo.created_at DESC;