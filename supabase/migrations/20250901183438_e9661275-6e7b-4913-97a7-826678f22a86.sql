-- Create a function to search appointments with proper JOINs
CREATE OR REPLACE FUNCTION public.search_appointments_paginated(
    search_term TEXT DEFAULT NULL,
    status_filter appointment_status DEFAULT NULL,
    date_from DATE DEFAULT NULL,
    date_to DATE DEFAULT NULL,
    user_role user_role DEFAULT NULL,
    user_profile_id UUID DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    patient_id UUID,
    doctor_id UUID,
    appointment_date DATE,
    appointment_time TIME,
    duration_minutes INTEGER,
    status appointment_status,
    reason TEXT,
    notes TEXT,
    diagnosis TEXT,
    treatment_plan TEXT,
    no_show_reason TEXT,
    session_deducted BOOLEAN,
    pardoned_by UUID,
    pardoned_at TIMESTAMPTZ,
    pardon_reason TEXT,
    rescheduled_from_id UUID,
    rescheduled_to_id UUID,
    rescheduled_at TIMESTAMPTZ,
    rescheduled_by UUID,
    reschedule_reason TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    patient_profile_id UUID,
    patient_first_name TEXT,
    patient_last_name TEXT,
    patient_dni TEXT,
    doctor_profile_id UUID,
    doctor_first_name TEXT,
    doctor_last_name TEXT,
    specialty_id UUID,
    specialty_name TEXT,
    specialty_color TEXT,
    total_count BIGINT
) 
LANGUAGE sql
SECURITY DEFINER
AS $function$
    WITH filtered_appointments AS (
        SELECT 
            a.*,
            pp.id as patient_profile_id,
            pp.first_name as patient_first_name,
            pp.last_name as patient_last_name,
            pp.dni as patient_dni,
            dp.id as doctor_profile_id,
            dp.first_name as doctor_first_name,
            dp.last_name as doctor_last_name,
            s.id as specialty_id,
            s.name as specialty_name,
            s.color as specialty_color
        FROM appointments a
        INNER JOIN patients p ON a.patient_id = p.id
        INNER JOIN profiles pp ON p.profile_id = pp.id
        INNER JOIN doctors d ON a.doctor_id = d.id
        INNER JOIN profiles dp ON d.profile_id = dp.id
        INNER JOIN specialties s ON d.specialty_id = s.id
        WHERE 
            -- Role-based filtering
            CASE 
                WHEN user_role = 'patient' THEN p.profile_id = user_profile_id
                WHEN user_role = 'doctor' THEN d.profile_id = user_profile_id
                ELSE TRUE -- admin can see all
            END
            -- Status filter
            AND (status_filter IS NULL OR a.status = status_filter)
            -- Date filters
            AND (date_from IS NULL OR a.appointment_date >= date_from)
            AND (date_to IS NULL OR a.appointment_date <= date_to)
            -- Text search filter
            AND (
                search_term IS NULL OR search_term = '' OR
                pp.first_name ILIKE '%' || search_term || '%' OR
                pp.last_name ILIKE '%' || search_term || '%' OR
                pp.dni ILIKE '%' || search_term || '%' OR
                dp.first_name ILIKE '%' || search_term || '%' OR
                dp.last_name ILIKE '%' || search_term || '%' OR
                s.name ILIKE '%' || search_term || '%' OR
                a.reason ILIKE '%' || search_term || '%' OR
                a.notes ILIKE '%' || search_term || '%'
            )
    ),
    total_count_query AS (
        SELECT COUNT(*) as total_count FROM filtered_appointments
    )
    SELECT 
        fa.*,
        tc.total_count
    FROM filtered_appointments fa
    CROSS JOIN total_count_query tc
    ORDER BY fa.appointment_date DESC, fa.appointment_time DESC
    LIMIT limit_count OFFSET offset_count;
$function$