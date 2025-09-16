-- Create a function to repair existing medical orders data integrity
-- This function will recalculate all sessions_used based on actual appointment_order_assignments

CREATE OR REPLACE FUNCTION public.repair_medical_orders_data_integrity()
RETURNS TABLE(
    order_id uuid, 
    patient_name text, 
    old_sessions_used integer, 
    new_sessions_used integer, 
    old_completed boolean, 
    new_completed boolean, 
    action_taken text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    order_rec RECORD;
    actual_sessions_count INTEGER;
    should_be_completed BOOLEAN;
BEGIN
    RAISE NOTICE 'Starting medical orders data integrity repair...';
    
    -- Process each medical order
    FOR order_rec IN 
        SELECT 
            mo.id,
            mo.sessions_used,
            mo.total_sessions,
            mo.completed,
            CONCAT(p.first_name, ' ', p.last_name) as patient_name
        FROM medical_orders mo
        JOIN patients pt ON mo.patient_id = pt.id
        JOIN profiles p ON pt.profile_id = p.id
        ORDER BY mo.created_at ASC
    LOOP
        -- Count actual completed sessions assigned to this order
        SELECT COUNT(*)
        INTO actual_sessions_count
        FROM appointment_order_assignments aoa
        JOIN appointments a ON a.id = aoa.appointment_id
        WHERE aoa.medical_order_id = order_rec.id
        AND a.status = 'completed';
        
        -- Determine if order should be completed
        should_be_completed := actual_sessions_count >= order_rec.total_sessions;
        
        -- Only update if there's a discrepancy
        IF order_rec.sessions_used != actual_sessions_count OR order_rec.completed != should_be_completed THEN
            
            -- Update the medical order with correct data
            UPDATE medical_orders 
            SET 
                sessions_used = actual_sessions_count,
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
            new_sessions_used := actual_sessions_count;
            old_completed := order_rec.completed;
            new_completed := should_be_completed;
            action_taken := CASE 
                WHEN order_rec.sessions_used > actual_sessions_count THEN 'Reduced sessions_used'
                WHEN order_rec.sessions_used < actual_sessions_count THEN 'Increased sessions_used'
                ELSE 'Updated completion status'
            END;
            
            RETURN NEXT;
            
            RAISE NOTICE 'Fixed order % for patient %: % -> % sessions, completed: % -> %', 
                order_rec.id, order_rec.patient_name, order_rec.sessions_used, 
                actual_sessions_count, order_rec.completed, should_be_completed;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Medical orders data integrity repair completed.';
END;
$function$;