-- Fix the recalc_order_sessions function to only count actually completed sessions
-- This function was incorrectly counting scheduled/confirmed sessions as completed

CREATE OR REPLACE FUNCTION public.recalc_order_sessions(order_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    total_assigned_sessions INTEGER;
    completed_sessions_count INTEGER;
BEGIN
    -- Count all sessions assigned to this order (for tracking purposes)
    SELECT COUNT(*)
    INTO total_assigned_sessions
    FROM appointment_order_assignments aoa
    JOIN appointments a ON aoa.appointment_id = a.id
    WHERE aoa.medical_order_id = order_id_param;
    
    -- Count ONLY actually completed sessions for determining completion status
    SELECT COUNT(*)
    INTO completed_sessions_count
    FROM appointment_order_assignments aoa
    JOIN appointments a ON aoa.appointment_id = a.id
    WHERE aoa.medical_order_id = order_id_param
    AND a.status = 'completed';
    
    -- Update medical order with correct completion logic
    UPDATE medical_orders
    SET 
        sessions_used = completed_sessions_count,  -- Only count completed sessions
        completed = (completed_sessions_count >= total_sessions),  -- Complete only when sessions are actually attended
        completed_at = CASE 
            WHEN (completed_sessions_count >= total_sessions) AND completed = false 
            THEN NOW() 
            ELSE completed_at 
        END,
        updated_at = NOW()
    WHERE id = order_id_param;
    
    RAISE NOTICE 'Orden % recalculada: % sesiones completadas de % asignadas', order_id_param, completed_sessions_count, total_assigned_sessions;
END;
$function$;