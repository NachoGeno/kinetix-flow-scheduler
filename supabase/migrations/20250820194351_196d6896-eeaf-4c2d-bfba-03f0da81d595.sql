-- Fix the check_presentation_ready function to resolve column ambiguity
CREATE OR REPLACE FUNCTION check_presentation_ready(order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    total_sessions_count INTEGER;
    completed_sessions_count INTEGER;
    order_completed BOOLEAN;
BEGIN
    -- Get the total sessions and completion status for the medical order
    SELECT mo.total_sessions, mo.completed
    INTO total_sessions_count, order_completed
    FROM medical_orders mo
    WHERE mo.id = order_id;
    
    -- If order is already marked as completed, it's ready
    IF order_completed THEN
        RETURN TRUE;
    END IF;
    
    -- Count completed appointments for this medical order
    SELECT COUNT(*)
    INTO completed_sessions_count
    FROM appointments a
    WHERE a.appointment_id IN (
        SELECT ap.id 
        FROM appointments ap 
        JOIN medical_orders mo ON ap.patient_id = mo.patient_id
        WHERE mo.id = order_id
        AND ap.status IN ('completed', 'in_progress')
    );
    
    -- Check if all sessions are completed
    RETURN completed_sessions_count >= total_sessions_count;
END;
$$;