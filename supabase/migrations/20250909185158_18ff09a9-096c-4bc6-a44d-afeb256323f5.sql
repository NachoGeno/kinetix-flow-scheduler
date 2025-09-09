-- Complete System Correction for Session Counting
-- This will fix the session distribution issue affecting 192 patients and 254 medical orders

-- First, delete the unnecessary medical order created for Hugo García
DELETE FROM medical_orders 
WHERE patient_id = '85512525-eedf-4269-93f5-db6aa72dff65'::UUID 
AND description = 'Continuación tratamiento kinesiológico'
AND created_at >= '2025-01-09'::date;

-- Create the corrected version of fix_medical_orders_data_integrity function
CREATE OR REPLACE FUNCTION public.fix_medical_orders_data_integrity()
RETURNS TABLE(order_id uuid, patient_name text, old_sessions_used integer, new_sessions_used integer, old_completed boolean, new_completed boolean, action_taken text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    patient_rec RECORD;
    order_rec RECORD;
    session_rec RECORD;
    current_sessions_assigned INTEGER := 0;
    sessions_for_this_order INTEGER := 0;
    should_be_completed BOOLEAN;
BEGIN
    RAISE NOTICE 'Starting CORRECTED medical orders data integrity fix...';
    
    -- Process each patient individually
    FOR patient_rec IN 
        SELECT DISTINCT 
            mo.patient_id,
            CONCAT(p.first_name, ' ', p.last_name) as patient_name
        FROM medical_orders mo
        JOIN patients pt ON mo.patient_id = pt.id
        JOIN profiles p ON pt.profile_id = p.id
        ORDER BY patient_name
    LOOP
        current_sessions_assigned := 0;
        
        RAISE NOTICE 'Processing patient: %', patient_rec.patient_name;
        
        -- For each patient, process their medical orders chronologically
        FOR order_rec IN 
            SELECT 
                mo.id,
                mo.patient_id,
                mo.sessions_used,
                mo.total_sessions,
                mo.completed,
                mo.created_at::DATE as order_date,
                patient_rec.patient_name
            FROM medical_orders mo
            WHERE mo.patient_id = patient_rec.patient_id
            ORDER BY mo.created_at ASC -- Process oldest orders first
        LOOP
            sessions_for_this_order := 0;
            
            -- Count completed sessions for this specific order
            -- Only sessions that occurred AFTER this order was created
            -- And that haven't been assigned to previous orders
            FOR session_rec IN 
                SELECT a.id, a.appointment_date, a.status
                FROM appointments a
                WHERE a.patient_id = order_rec.patient_id
                AND a.status = 'completed'
                AND a.appointment_date >= order_rec.order_date
                ORDER BY a.appointment_date ASC
            LOOP
                -- Only assign this session if we haven't reached the limit for previous orders
                -- and if this order still needs sessions
                IF current_sessions_assigned < (
                    SELECT COALESCE(SUM(mo2.total_sessions), 0)
                    FROM medical_orders mo2 
                    WHERE mo2.patient_id = order_rec.patient_id 
                    AND mo2.created_at < order_rec.created_at
                ) THEN
                    -- This session belongs to a previous order, skip it
                    current_sessions_assigned := current_sessions_assigned + 1;
                    CONTINUE;
                END IF;
                
                -- This session can be assigned to the current order
                IF sessions_for_this_order < order_rec.total_sessions THEN
                    sessions_for_this_order := sessions_for_this_order + 1;
                    current_sessions_assigned := current_sessions_assigned + 1;
                END IF;
                
                -- If this order is full, stop assigning sessions to it
                IF sessions_for_this_order >= order_rec.total_sessions THEN
                    EXIT;
                END IF;
            END LOOP;
            
            -- Determine if this order should be completed
            should_be_completed := sessions_for_this_order >= order_rec.total_sessions;
            
            -- Only update if there's a discrepancy
            IF order_rec.sessions_used != sessions_for_this_order OR order_rec.completed != should_be_completed THEN
                
                -- Update the medical order with correct data
                UPDATE medical_orders 
                SET 
                    sessions_used = sessions_for_this_order,
                    completed = should_be_completed,
                    completed_at = CASE 
                        WHEN should_be_completed AND completed_at IS NULL THEN NOW()
                        WHEN NOT should_be_completed THEN NULL
                        ELSE completed_at
                    END,
                    updated_at = NOW()
                WHERE id = order_rec.id;
                
                -- Return the correction details
                order_id := order_rec.id;
                patient_name := order_rec.patient_name;
                old_sessions_used := order_rec.sessions_used;
                new_sessions_used := sessions_for_this_order;
                old_completed := order_rec.completed;
                new_completed := should_be_completed;
                action_taken := CASE 
                    WHEN order_rec.sessions_used > sessions_for_this_order THEN 'Reduced sessions_used (removed duplicates)'
                    WHEN order_rec.sessions_used < sessions_for_this_order THEN 'Increased sessions_used'
                    WHEN order_rec.completed != should_be_completed THEN 'Updated completion status'
                    ELSE 'General correction'
                END;
                
                RETURN NEXT;
                
                RAISE NOTICE 'Fixed order % for %: sessions % → %, completed % → %', 
                    order_rec.id, order_rec.patient_name, order_rec.sessions_used, sessions_for_this_order, order_rec.completed, should_be_completed;
            END IF;
            
        END LOOP;
        
    END LOOP;
    
    RAISE NOTICE 'CORRECTED medical orders data integrity fix completed.';
    RETURN;
END;
$function$;

-- Execute the corrected function to fix all medical orders
SELECT * FROM fix_medical_orders_data_integrity();

-- Update the auto_generate_final_summary trigger function to use the same corrected logic
CREATE OR REPLACE FUNCTION public.auto_generate_final_summary()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_medical_order_id UUID;
    v_total_sessions INTEGER;
    v_completed_sessions INTEGER;
    v_unified_history_id UUID;
    v_final_summary JSONB;
    v_order_creation_date DATE;
BEGIN
    -- Only process if the appointment is being marked as completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Find the active medical order for this patient (most recent non-completed order)
        SELECT mo.id, mo.total_sessions, mo.created_at::DATE
        INTO v_medical_order_id, v_total_sessions, v_order_creation_date
        FROM medical_orders mo
        WHERE mo.patient_id = NEW.patient_id
        AND mo.completed = false
        ORDER BY mo.created_at DESC
        LIMIT 1;
        
        IF v_medical_order_id IS NOT NULL THEN
            -- Count completed sessions for this specific order
            -- Only sessions that occurred AFTER this order was created
            -- And considering sessions already assigned to previous completed orders
            WITH previous_completed_orders AS (
                SELECT mo.id, mo.created_at::DATE as order_date, mo.sessions_used, mo.total_sessions
                FROM medical_orders mo
                WHERE mo.patient_id = NEW.patient_id 
                AND mo.completed = true 
                AND mo.created_at < (SELECT created_at FROM medical_orders WHERE id = v_medical_order_id)
                ORDER BY mo.created_at
            ),
            sessions_used_by_previous_orders AS (
                SELECT COALESCE(SUM(total_sessions), 0) as total_used
                FROM previous_completed_orders
            ),
            available_sessions AS (
                SELECT 
                    a.id,
                    a.appointment_date,
                    ROW_NUMBER() OVER (ORDER BY a.appointment_date) as session_order
                FROM appointments a
                WHERE a.patient_id = NEW.patient_id
                AND a.status = 'completed'
                AND a.appointment_date >= v_order_creation_date
            )
            SELECT COUNT(*)
            INTO v_completed_sessions
            FROM available_sessions av
            CROSS JOIN sessions_used_by_previous_orders supo
            WHERE av.session_order > supo.total_used
            AND av.session_order <= supo.total_used + v_total_sessions;
            
            -- If this completion fills up the order, generate final summary
            IF v_completed_sessions >= v_total_sessions THEN
                
                -- Get or create unified_medical_history
                SELECT id INTO v_unified_history_id
                FROM unified_medical_histories
                WHERE medical_order_id = v_medical_order_id;
                
                IF v_unified_history_id IS NULL THEN
                    INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data)
                    VALUES (v_medical_order_id, NEW.patient_id, '{}')
                    RETURNING id INTO v_unified_history_id;
                END IF;
                
                -- Generate automatic final summary
                v_final_summary := jsonb_build_object(
                    'final_summary', jsonb_build_object(
                        'total_sessions_completed', v_completed_sessions,
                        'completion_date', NOW(),
                        'summary', 'Tratamiento completado según orden médica. Todas las sesiones han sido realizadas.',
                        'recommendations', 'Seguimiento según indicación médica.',
                        'generated_automatically', true
                    )
                );
                
                -- Update the unified_medical_history with final summary
                UPDATE unified_medical_histories
                SET template_data = COALESCE(template_data, '{}'::jsonb) || v_final_summary,
                    updated_at = NOW()
                WHERE id = v_unified_history_id;
                
                -- Mark the medical order as completed
                UPDATE medical_orders
                SET 
                    sessions_used = v_completed_sessions,
                    completed = true,
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE id = v_medical_order_id;
                
                RAISE NOTICE 'Auto-generated final summary for completed order %', v_medical_order_id;
            ELSE
                -- Update sessions_used without completing the order
                UPDATE medical_orders
                SET 
                    sessions_used = v_completed_sessions,
                    updated_at = NOW()
                WHERE id = v_medical_order_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Verify Hugo García's corrected status
SELECT 
    mo.id,
    mo.description,
    mo.total_sessions,
    mo.sessions_used,
    mo.completed,
    mo.created_at::DATE as order_date,
    CONCAT(p.first_name, ' ', p.last_name) as patient_name
FROM medical_orders mo
JOIN patients pt ON mo.patient_id = pt.id
JOIN profiles p ON pt.profile_id = p.id
WHERE p.first_name ILIKE '%Hugo%' AND p.last_name ILIKE '%Garcia%'
ORDER BY mo.created_at;

-- Show summary of all corrections applied
SELECT 
    COUNT(*) as total_orders_corrected,
    COUNT(DISTINCT patient_id) as patients_affected,
    SUM(CASE WHEN old_completed != new_completed THEN 1 ELSE 0 END) as completion_status_changes,
    SUM(CASE WHEN old_sessions_used != new_sessions_used THEN 1 ELSE 0 END) as session_count_changes
FROM (
    SELECT * FROM fix_medical_orders_data_integrity()
) corrections;