-- Función mejorada para corregir datos inconsistentes en órdenes médicas
-- que maneja constraints y casos edge
CREATE OR REPLACE FUNCTION public.fix_medical_orders_data_integrity()
RETURNS TABLE(order_id UUID, patient_name TEXT, old_sessions_used INTEGER, new_sessions_used INTEGER, old_completed BOOLEAN, new_completed BOOLEAN, action_taken TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    real_completed_count INTEGER;
    should_be_completed BOOLEAN;
    corrected_sessions INTEGER;
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
        
        -- Determinar la cantidad correcta de sesiones (no puede exceder el total)
        corrected_sessions := LEAST(real_completed_count, rec.total_sessions);
        
        -- Determine if order should actually be completed
        should_be_completed := real_completed_count >= rec.total_sessions;
        
        -- Only update if there's a discrepancy
        IF rec.sessions_used != corrected_sessions OR rec.completed != should_be_completed THEN
            
            -- Update the medical order with correct data
            UPDATE medical_orders 
            SET 
                sessions_used = corrected_sessions,
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
            new_sessions_used := corrected_sessions;
            old_completed := rec.completed;
            new_completed := should_be_completed;
            action_taken := CASE 
                WHEN real_completed_count > rec.total_sessions THEN 'Capped sessions to total_sessions'
                WHEN rec.sessions_used != corrected_sessions THEN 'Updated sessions_used to match reality'
                WHEN rec.completed != should_be_completed THEN 'Updated completion status'
                ELSE 'General correction'
            END;
            
            RETURN NEXT;
            
            RAISE NOTICE 'Fixed order % for %: sessions % → %, completed % → %, real_sessions: %', 
                rec.id, rec.patient_name, rec.sessions_used, corrected_sessions, rec.completed, should_be_completed, real_completed_count;
        END IF;
        
    END LOOP;
    
    RAISE NOTICE 'Medical orders data integrity correction completed.';
    RETURN;
END;
$$;

-- Ejecutar la corrección de datos
SELECT * FROM public.fix_medical_orders_data_integrity();