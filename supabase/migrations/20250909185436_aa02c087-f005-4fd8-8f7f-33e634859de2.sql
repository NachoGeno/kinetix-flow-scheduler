-- Complete System Correction for Session Counting - FIXED VERSION
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
    previous_orders_total_sessions INTEGER := 0;
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
                mo.created_at as order_created_at,
                patient_rec.patient_name
            FROM medical_orders mo
            WHERE mo.patient_id = patient_rec.patient_id
            ORDER BY mo.created_at ASC -- Process oldest orders first
        LOOP
            sessions_for_this_order := 0;
            
            -- Calculate total sessions from previous orders
            SELECT COALESCE(SUM(mo2.total_sessions), 0)
            INTO previous_orders_total_sessions
            FROM medical_orders mo2 
            WHERE mo2.patient_id = order_rec.patient_id 
            AND mo2.created_at < order_rec.order_created_at;
            
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
                IF current_sessions_assigned < previous_orders_total_sessions THEN
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