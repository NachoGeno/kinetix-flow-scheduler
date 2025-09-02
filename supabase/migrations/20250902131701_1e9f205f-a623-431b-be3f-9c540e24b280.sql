-- Create a function for efficient patient search
CREATE OR REPLACE FUNCTION public.search_patients_paginated(
    search_term text DEFAULT NULL,
    page_number integer DEFAULT 1,
    page_size integer DEFAULT 50
)
RETURNS TABLE(
    patient_data jsonb,
    total_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
    WITH filtered_patients AS (
        SELECT 
            jsonb_build_object(
                'id', p.id,
                'profile_id', p.profile_id,
                'medical_record_number', p.medical_record_number,
                'blood_type', p.blood_type,
                'insurance_provider', p.insurance_provider,
                'insurance_number', p.insurance_number,
                'obra_social_art_id', p.obra_social_art_id,
                'allergies', p.allergies,
                'current_medications', p.current_medications,
                'created_at', p.created_at,
                'updated_at', p.updated_at,
                'profile', jsonb_build_object(
                    'first_name', pr.first_name,
                    'last_name', pr.last_name,
                    'dni', pr.dni,
                    'email', pr.email,
                    'phone', pr.phone,
                    'date_of_birth', pr.date_of_birth,
                    'avatar_url', pr.avatar_url
                )
            ) as patient_json
        FROM patients p
        INNER JOIN profiles pr ON p.profile_id = pr.id
        WHERE 
            p.is_active = true
            AND (
                search_term IS NULL 
                OR search_term = '' 
                OR pr.first_name ILIKE '%' || search_term || '%'
                OR pr.last_name ILIKE '%' || search_term || '%'
                OR pr.email ILIKE '%' || search_term || '%'
                OR pr.dni ILIKE '%' || search_term || '%'
                OR p.medical_record_number ILIKE '%' || search_term || '%'
                OR CONCAT(pr.first_name, ' ', pr.last_name) ILIKE '%' || search_term || '%'
            )
        ORDER BY p.created_at DESC
    ),
    total_count_query AS (
        SELECT COUNT(*) as total_count FROM filtered_patients
    ),
    paginated_results AS (
        SELECT patient_json 
        FROM filtered_patients
        LIMIT page_size 
        OFFSET (page_number - 1) * page_size
    )
    SELECT 
        pr.patient_json as patient_data,
        tc.total_count
    FROM paginated_results pr
    CROSS JOIN total_count_query tc;
$$;