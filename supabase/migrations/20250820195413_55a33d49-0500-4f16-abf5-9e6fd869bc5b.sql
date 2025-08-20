-- Fix the check_presentation_ready function to correctly count sessions per medical order
CREATE OR REPLACE FUNCTION check_presentation_ready(order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    total_sessions_count INTEGER;
    sessions_used_count INTEGER;
    order_completed BOOLEAN;
BEGIN
    -- Get the total sessions, sessions used, and completion status for the medical order
    SELECT mo.total_sessions, mo.sessions_used, mo.completed
    INTO total_sessions_count, sessions_used_count, order_completed
    FROM medical_orders mo
    WHERE mo.id = order_id;
    
    -- If order is already marked as completed, it's ready
    IF order_completed THEN
        RETURN TRUE;
    END IF;
    
    -- Check if all sessions are completed based on sessions_used field
    -- This field is updated when appointments are completed for this specific order
    RETURN sessions_used_count >= total_sessions_count;
END;
$$;