-- Create optimized search function for presentations with pagination
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
AS $function$
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
            mo.created_at,
            mo.updated_at,
            -- Patient information
            CONCAT(pt_profile.first_name, ' ', pt_profile.last_name) as patient_name,
            pt_profile.dni as patient_dni,
            pt_profile.email as patient_email,
            pt_profile.phone as patient_phone,
            -- Professional information
            CASE 
                WHEN mo.doctor_id IS NOT NULL 
                THEN CONCAT(doc_profile.first_name, ' ', doc_profile.last_name)
                ELSE 'Sin asignar'
            END as professional_name,
            -- Social work information
            osa.nombre as obra_social_name,
            osa.tipo as obra_social_type,
            -- Document counts and status
            COALESCE(pd_counts.document_count, 0) as document_count,
            COALESCE(pd_counts.has_documents, false) as has_documents,
            -- Session completion status
            CASE 
                WHEN mo.completed = true THEN true
                WHEN mo.total_sessions > 0 AND mo.sessions_used >= mo.total_sessions THEN true
                ELSE false
            END as sessions_completed,
            -- Completed sessions count from appointments
            COALESCE(completed_sessions.count, 0) as completed_appointments_count
        FROM medical_orders mo
        INNER JOIN patients pt ON mo.patient_id = pt.id
        INNER JOIN profiles pt_profile ON pt.profile_id = pt_profile.id
        LEFT JOIN obras_sociales_art osa ON mo.obra_social_art_id = osa.id
        LEFT JOIN doctors d ON mo.doctor_id = d.id
        LEFT JOIN profiles doc_profile ON d.profile_id = doc_profile.id
        LEFT JOIN (
            SELECT 
                medical_order_id,
                COUNT(*) as document_count,
                COUNT(*) > 0 as has_documents
            FROM presentation_documents
            GROUP BY medical_order_id
        ) pd_counts ON mo.id = pd_counts.medical_order_id
        LEFT JOIN (
            SELECT 
                aoa.medical_order_id,
                COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as count
            FROM appointment_order_assignments aoa
            INNER JOIN appointments a ON aoa.appointment_id = a.id
            GROUP BY aoa.medical_order_id
        ) completed_sessions ON mo.id = completed_sessions.medical_order_id
        WHERE 
            mo.organization_id = get_current_user_organization_id()
            -- Search term filter
            AND (
                search_term IS NULL 
                OR search_term = '' 
                OR pt_profile.first_name ILIKE '%' || search_term || '%'
                OR pt_profile.last_name ILIKE '%' || search_term || '%'
                OR pt_profile.dni ILIKE '%' || search_term || '%'
                OR CONCAT(pt_profile.first_name, ' ', pt_profile.last_name) ILIKE '%' || search_term || '%'
                OR mo.description ILIKE '%' || search_term || '%'
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
                    status_filter = 'ready' AND (
                        mo.completed = true 
                        OR (mo.total_sessions > 0 AND mo.sessions_used >= mo.total_sessions)
                    )
                )
                OR (
                    status_filter = 'pending' AND (
                        mo.completed = false 
                        AND (mo.total_sessions = 0 OR mo.sessions_used < mo.total_sessions)
                    )
                )
                OR (status_filter = 'submitted' AND mo.presentation_status = 'submitted')
            )
        ORDER BY 
            mo.urgent DESC,
            mo.order_date DESC,
            mo.created_at DESC
    ),
    total_count_query AS (
        SELECT COUNT(*) as total_count FROM filtered_orders
    ),
    paginated_results AS (
        SELECT * FROM filtered_orders
        LIMIT page_size 
        OFFSET (page_number - 1) * page_size
    )
    SELECT 
        jsonb_build_object(
            'id', pr.id,
            'patient_id', pr.patient_id,
            'doctor_id', pr.doctor_id,
            'description', pr.description,
            'order_type', pr.order_type,
            'total_sessions', pr.total_sessions,
            'sessions_used', pr.sessions_used,
            'completed', pr.completed,
            'urgent', pr.urgent,
            'order_date', pr.order_date,
            'obra_social_art_id', pr.obra_social_art_id,
            'organization_id', pr.organization_id,
            'document_status', pr.document_status,
            'presentation_status', pr.presentation_status,
            'created_at', pr.created_at,
            'updated_at', pr.updated_at,
            'patient_name', pr.patient_name,
            'patient_dni', pr.patient_dni,
            'patient_email', pr.patient_email,
            'patient_phone', pr.patient_phone,
            'professional_name', pr.professional_name,
            'obra_social_name', pr.obra_social_name,
            'obra_social_type', pr.obra_social_type,
            'document_count', pr.document_count,
            'has_documents', pr.has_documents,
            'sessions_completed', pr.sessions_completed,
            'completed_appointments_count', pr.completed_appointments_count
        ) as presentation_data,
        tc.total_count
    FROM paginated_results pr
    CROSS JOIN total_count_query tc;
$function$;