-- Update function to include all necessary fields for the UI
CREATE OR REPLACE FUNCTION public.get_medical_orders_with_availability(patient_id_param uuid)
RETURNS TABLE(
    id uuid,
    patient_id uuid,
    doctor_id uuid,
    order_type order_type,
    description text,
    instructions text,
    total_sessions integer,
    sessions_used integer,
    active_assignments_count integer,
    sessions_remaining integer,
    completed boolean,
    urgent boolean,
    order_date date,
    obra_social_art_id uuid,
    organization_id uuid,
    document_status text,
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
        mo.instructions,
        mo.total_sessions,
        mo.sessions_used,
        get_active_assignments_count(mo.id) as active_assignments_count,
        (mo.total_sessions - get_active_assignments_count(mo.id)) as sessions_remaining,
        mo.completed,
        mo.urgent,
        mo.order_date,
        mo.obra_social_art_id,
        mo.organization_id,
        mo.document_status,
        mo.created_at,
        mo.updated_at
    FROM medical_orders mo
    WHERE mo.patient_id = patient_id_param
    AND mo.organization_id = get_current_user_organization_id()
    AND (mo.total_sessions - get_active_assignments_count(mo.id)) > 0
    AND mo.completed = false
    ORDER BY mo.created_at DESC;
$function$;