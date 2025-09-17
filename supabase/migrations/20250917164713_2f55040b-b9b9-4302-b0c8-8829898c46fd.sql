-- Create function to count active appointments assigned to a medical order
CREATE OR REPLACE FUNCTION public.get_active_assignments_count(order_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT COUNT(*)::integer
    FROM appointment_order_assignments aoa
    JOIN appointments a ON aoa.appointment_id = a.id
    WHERE aoa.medical_order_id = order_id_param
    AND a.status IN ('scheduled', 'confirmed', 'in_progress', 'completed');
$function$;

-- Create function to get medical orders with available sessions for appointment scheduling
CREATE OR REPLACE FUNCTION public.get_medical_orders_with_availability(patient_id_param uuid)
RETURNS TABLE(
    id uuid,
    patient_id uuid,
    doctor_id uuid,
    order_type order_type,
    description text,
    total_sessions integer,
    sessions_used integer,
    active_assignments_count integer,
    sessions_remaining integer,
    completed boolean,
    urgent boolean,
    order_date date,
    obra_social_art_id uuid,
    organization_id uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT 
        mo.id,
        mo.patient_id,
        mo.doctor_id,
        mo.order_type,
        mo.description,
        mo.total_sessions,
        mo.sessions_used,
        get_active_assignments_count(mo.id) as active_assignments_count,
        (mo.total_sessions - get_active_assignments_count(mo.id)) as sessions_remaining,
        mo.completed,
        mo.urgent,
        mo.order_date,
        mo.obra_social_art_id,
        mo.organization_id,
        mo.created_at,
        mo.updated_at
    FROM medical_orders mo
    WHERE mo.patient_id = patient_id_param
    AND mo.organization_id = get_current_user_organization_id()
    AND (mo.total_sessions - get_active_assignments_count(mo.id)) > 0
    AND mo.completed = false
    ORDER BY mo.created_at DESC;
$function$;

-- Create function to validate appointment assignment capacity
CREATE OR REPLACE FUNCTION public.validate_appointment_assignment_capacity(order_id_param uuid, additional_sessions integer DEFAULT 1)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
    SELECT 
        CASE 
            WHEN mo.total_sessions IS NULL THEN true
            ELSE (get_active_assignments_count(order_id_param) + additional_sessions) <= mo.total_sessions
        END
    FROM medical_orders mo
    WHERE mo.id = order_id_param;
$function$;