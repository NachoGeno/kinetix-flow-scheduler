-- Create function to identify medical orders with over-assignments
CREATE OR REPLACE FUNCTION public.analyze_medical_order_assignments()
RETURNS TABLE(
    patient_name text,
    order_id uuid,
    order_description text,
    total_sessions integer,
    active_assignments integer,
    sessions_used integer,
    over_assignment integer,
    order_completed boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT 
        CONCAT(pr.first_name, ' ', pr.last_name) as patient_name,
        mo.id as order_id,
        mo.description as order_description,
        mo.total_sessions,
        get_active_assignments_count(mo.id) as active_assignments,
        mo.sessions_used,
        (get_active_assignments_count(mo.id) - mo.total_sessions) as over_assignment,
        mo.completed as order_completed
    FROM medical_orders mo
    JOIN patients p ON mo.patient_id = p.id
    JOIN profiles pr ON p.profile_id = pr.id
    WHERE mo.organization_id = get_current_user_organization_id()
    AND get_active_assignments_count(mo.id) > mo.total_sessions
    ORDER BY (get_active_assignments_count(mo.id) - mo.total_sessions) DESC;
$function$;