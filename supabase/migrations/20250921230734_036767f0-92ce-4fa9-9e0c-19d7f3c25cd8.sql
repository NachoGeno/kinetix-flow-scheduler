-- Fix ambiguous column reference in recalc_order_sessions function
CREATE OR REPLACE FUNCTION public.recalc_order_sessions(order_id_param uuid)
RETURNS VOID AS $$
DECLARE
    total_assigned_sessions INTEGER;
    completed_sessions_count INTEGER;
BEGIN
    -- Count all sessions assigned to this order (for tracking purposes)
    -- Fix ambiguous column references by fully qualifying all columns
    SELECT COUNT(*)
    INTO total_assigned_sessions
    FROM appointment_order_assignments aoa
    JOIN appointments a ON aoa.appointment_id = a.id
    WHERE aoa.medical_order_id = order_id_param;
    
    -- Count ONLY actually completed sessions for determining completion status
    -- Fix ambiguous column references by fully qualifying all columns
    SELECT COUNT(*)
    INTO completed_sessions_count
    FROM appointment_order_assignments aoa
    JOIN appointments a ON aoa.appointment_id = a.id
    WHERE aoa.medical_order_id = order_id_param
    AND a.status = 'completed';
    
    -- Update medical order with correct completion logic
    UPDATE medical_orders mo
    SET 
        sessions_used = completed_sessions_count,  -- Only count completed sessions
        completed = (completed_sessions_count >= mo.total_sessions),  -- Complete only when sessions are actually attended
        completed_at = CASE 
            WHEN (completed_sessions_count >= mo.total_sessions) AND mo.completed = false 
            THEN NOW() 
            ELSE mo.completed_at 
        END,
        updated_at = NOW()
    WHERE mo.id = order_id_param;
    
    RAISE NOTICE 'Orden % recalculada: % sesiones completadas de % asignadas', order_id_param, completed_sessions_count, total_assigned_sessions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;