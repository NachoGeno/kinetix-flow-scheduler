-- Fix presentation readiness: base it on completed sessions assigned to the order, not sessions_used
CREATE OR REPLACE FUNCTION public.check_presentation_ready(order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_order medical_orders%ROWTYPE;
    v_completed_sessions INTEGER := 0;
BEGIN
    -- Get the medical order
    SELECT * INTO v_order
    FROM medical_orders
    WHERE id = order_id;

    -- If order not found, not ready
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- If order manually completed, it's ready
    IF COALESCE(v_order.completed, false) = true THEN
        RETURN true;
    END IF;

    -- Count only completed appointments assigned to this order
    SELECT COUNT(*)
    INTO v_completed_sessions
    FROM appointment_order_assignments aoa
    JOIN appointments a ON a.id = aoa.appointment_id
    WHERE aoa.medical_order_id = order_id
      AND a.status = 'completed';

    -- Ready when completed sessions meet or exceed total_sessions
    RETURN v_completed_sessions >= COALESCE(v_order.total_sessions, 0);
END;
$function$;