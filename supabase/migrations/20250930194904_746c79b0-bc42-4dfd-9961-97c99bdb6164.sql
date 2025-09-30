-- Update search_presentations_paginated to include early_discharge field
CREATE OR REPLACE FUNCTION public.search_presentations_paginated(
    search_term text DEFAULT NULL,
    obra_social_filter uuid DEFAULT NULL,
    professional_filter uuid DEFAULT NULL,
    status_filter text DEFAULT NULL,
    date_from date DEFAULT NULL,
    date_to date DEFAULT NULL,
    page_number integer DEFAULT 1,
    page_size integer DEFAULT 50
)
RETURNS TABLE(
    presentation_data jsonb,
    total_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    WITH filtered_orders AS (
        SELECT 
            mo.id,
            mo.patient_id,
            mo.doctor_id,
            mo.description,
            mo.order_type,
            mo.total_sessions,
            mo.sessions_used,
            mo.completed,
            mo.urgent,
            mo.order_date,
            mo.obra_social_art_id,
            mo.organization_id,
            mo.document_status,
            mo.presentation_status,
            mo.early_discharge,
            mo.created_at,
            mo.updated_at,
            CONCAT(pp.first_name, ' ', pp.last_name) as patient_name,
            pp.dni as patient_dni,
            pp.email as patient_email,
            pp.phone as patient_phone,
            CONCAT(dp.first_name, ' ', dp.last_name) as professional_name,
            osa.nombre as obra_social_name,
            osa.tipo as obra_social_type,
            -- Count documents
            (SELECT COUNT(*) 
             FROM presentation_documents pd 
             WHERE pd.medical_order_id = mo.id) as document_count,
            -- Check if has documents
            (SELECT COUNT(*) > 0 
             FROM presentation_documents pd 
             WHERE pd.medical_order_id = mo.id) as has_documents,
            -- Check if sessions completed
            (mo.sessions_used >= mo.total_sessions OR mo.completed = true) as sessions_completed,
            -- Count completed appointments
            (SELECT COUNT(*)
             FROM appointment_order_assignments aoa
             JOIN appointments a ON aoa.appointment_id = a.id
             WHERE aoa.medical_order_id = mo.id
             AND a.status = 'completed') as completed_appointments_count
        FROM medical_orders mo
        JOIN patients p ON mo.patient_id = p.id
        JOIN profiles pp ON p.profile_id = pp.id
        LEFT JOIN doctors d ON mo.doctor_id = d.id
        LEFT JOIN profiles dp ON d.profile_id = dp.id
        LEFT JOIN obras_sociales_art osa ON mo.obra_social_art_id = osa.id
        WHERE 
            mo.organization_id = get_current_user_organization_id()
            -- Search filter
            AND (
                search_term IS NULL 
                OR search_term = '' 
                OR pp.first_name ILIKE '%' || search_term || '%'
                OR pp.last_name ILIKE '%' || search_term || '%'
                OR pp.dni ILIKE '%' || search_term || '%'
                OR mo.description ILIKE '%' || search_term || '%'
                OR CONCAT(pp.first_name, ' ', pp.last_name) ILIKE '%' || search_term || '%'
            )
            -- Obra social filter
            AND (obra_social_filter IS NULL OR mo.obra_social_art_id = obra_social_filter)
            -- Professional filter
            AND (professional_filter IS NULL OR mo.doctor_id = professional_filter)
            -- Date filters
            AND (date_from IS NULL OR mo.order_date >= date_from)
            AND (date_to IS NULL OR mo.order_date <= date_to)
            -- Status filter
            AND (
                status_filter IS NULL 
                OR status_filter = 'all'
                OR (
                    status_filter = 'pending' 
                    AND (mo.completed = false OR mo.sessions_used < mo.total_sessions)
                )
                OR (
                    status_filter = 'ready_to_present' 
                    AND mo.completed = true 
                    AND mo.presentation_status = 'pending'
                )
                OR (
                    status_filter = 'submitted' 
                    AND mo.presentation_status = 'submitted'
                )
            )
        ORDER BY mo.order_date DESC, mo.created_at DESC
    ),
    total_count_query AS (
        SELECT COUNT(*) as total_count FROM filtered_orders
    ),
    paginated_results AS (
        SELECT 
            jsonb_build_object(
                'id', fo.id,
                'patient_id', fo.patient_id,
                'doctor_id', fo.doctor_id,
                'description', fo.description,
                'order_type', fo.order_type,
                'total_sessions', fo.total_sessions,
                'sessions_used', fo.sessions_used,
                'completed', fo.completed,
                'urgent', fo.urgent,
                'order_date', fo.order_date,
                'obra_social_art_id', fo.obra_social_art_id,
                'organization_id', fo.organization_id,
                'document_status', fo.document_status,
                'presentation_status', fo.presentation_status,
                'early_discharge', fo.early_discharge,
                'created_at', fo.created_at,
                'updated_at', fo.updated_at,
                'patient_name', fo.patient_name,
                'patient_dni', fo.patient_dni,
                'patient_email', fo.patient_email,
                'patient_phone', fo.patient_phone,
                'professional_name', fo.professional_name,
                'obra_social_name', fo.obra_social_name,
                'obra_social_type', fo.obra_social_type,
                'document_count', fo.document_count,
                'has_documents', fo.has_documents,
                'sessions_completed', fo.sessions_completed,
                'completed_appointments_count', fo.completed_appointments_count
            ) as presentation_json
        FROM filtered_orders fo
        LIMIT page_size 
        OFFSET (page_number - 1) * page_size
    )
    SELECT 
        pr.presentation_json as presentation_data,
        tc.total_count
    FROM paginated_results pr
    CROSS JOIN total_count_query tc;
$$;