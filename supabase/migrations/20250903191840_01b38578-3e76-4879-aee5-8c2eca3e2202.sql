-- Arreglar el trigger auto_generate_final_summary para contar sesiones por orden médica específica
-- en lugar de contar todas las sesiones del paciente

CREATE OR REPLACE FUNCTION public.auto_generate_final_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_medical_order_id UUID;
    v_total_sessions INTEGER;
    v_completed_sessions INTEGER;
    v_unified_history_id UUID;
    v_final_summary JSONB;
    v_order_start_date DATE;
BEGIN
    -- Solo procesar si el appointment se está marcando como completado
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Buscar la orden médica activa más reciente del paciente
        SELECT mo.id, mo.total_sessions, mo.created_at::DATE
        INTO v_medical_order_id, v_total_sessions, v_order_start_date
        FROM medical_orders mo
        WHERE mo.patient_id = NEW.patient_id
        AND mo.completed = false
        ORDER BY mo.created_at DESC
        LIMIT 1;
        
        IF v_medical_order_id IS NOT NULL THEN
            -- Contar SOLO sesiones completadas DESPUÉS de la fecha de creación de esta orden específica
            SELECT COUNT(*)
            INTO v_completed_sessions
            FROM appointments a
            WHERE a.patient_id = NEW.patient_id
            AND a.status = 'completed'
            AND a.appointment_date >= v_order_start_date;
            
            -- Actualizar siempre el contador de sesiones usadas
            UPDATE medical_orders
            SET sessions_used = v_completed_sessions,
                updated_at = NOW()
            WHERE id = v_medical_order_id;
            
            -- Si se completaron todas las sesiones requeridas, marcar como completada
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
                    completed_at = NOW()
                WHERE id = v_medical_order_id;
                
                RAISE NOTICE 'Orden médica % completada automáticamente con % sesiones', v_medical_order_id, v_completed_sessions;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recrear el trigger
DROP TRIGGER IF EXISTS auto_generate_final_summary_trigger ON public.appointments;
CREATE TRIGGER auto_generate_final_summary_trigger
    AFTER UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_final_summary();

-- Función para corregir datos inconsistentes en órdenes médicas
CREATE OR REPLACE FUNCTION public.fix_medical_orders_data_integrity()
RETURNS TABLE(order_id UUID, patient_name TEXT, old_sessions_used INTEGER, new_sessions_used INTEGER, old_completed BOOLEAN, new_completed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    real_completed_count INTEGER;
    should_be_completed BOOLEAN;
BEGIN
    -- Log the start of the correction process
    RAISE NOTICE 'Starting medical orders data integrity correction...';
    
    -- Process each medical order that might have integrity issues
    FOR rec IN 
        SELECT 
            mo.id,
            mo.patient_id,
            mo.sessions_used,
            mo.total_sessions,
            mo.completed,
            mo.created_at::DATE as order_date,
            CONCAT(p.first_name, ' ', p.last_name) as patient_name
        FROM medical_orders mo
        JOIN patients pt ON mo.patient_id = pt.id
        JOIN profiles p ON pt.profile_id = p.id
        ORDER BY mo.created_at DESC
    LOOP
        -- Count REAL completed appointments for this patient AFTER order creation date
        SELECT COUNT(*)
        INTO real_completed_count
        FROM appointments a
        WHERE a.patient_id = rec.patient_id
        AND a.status = 'completed'
        AND a.appointment_date >= rec.order_date;
        
        -- Determine if order should actually be completed
        should_be_completed := real_completed_count >= rec.total_sessions;
        
        -- Only update if there's a discrepancy
        IF rec.sessions_used != real_completed_count OR rec.completed != should_be_completed THEN
            
            -- Update the medical order with correct data
            UPDATE medical_orders 
            SET 
                sessions_used = real_completed_count,
                completed = should_be_completed,
                completed_at = CASE 
                    WHEN should_be_completed AND completed_at IS NULL THEN NOW()
                    WHEN NOT should_be_completed THEN NULL
                    ELSE completed_at
                END,
                updated_at = NOW()
            WHERE id = rec.id;
            
            -- Return the correction details
            order_id := rec.id;
            patient_name := rec.patient_name;
            old_sessions_used := rec.sessions_used;
            new_sessions_used := real_completed_count;
            old_completed := rec.completed;
            new_completed := should_be_completed;
            
            RETURN NEXT;
            
            RAISE NOTICE 'Fixed order % for %: sessions % → %, completed % → %', 
                rec.id, rec.patient_name, rec.sessions_used, real_completed_count, rec.completed, should_be_completed;
        END IF;
        
    END LOOP;
    
    RAISE NOTICE 'Medical orders data integrity correction completed.';
    RETURN;
END;
$$;

-- Ejecutar la corrección de datos inmediatamente
SELECT * FROM public.fix_medical_orders_data_integrity();