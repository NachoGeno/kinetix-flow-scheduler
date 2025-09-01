-- Create a simpler function to search appointments with proper JOINs
CREATE OR REPLACE FUNCTION public.search_appointments_paginated(
    search_term TEXT DEFAULT NULL,
    status_filter TEXT DEFAULT NULL,
    date_from DATE DEFAULT NULL,
    date_to DATE DEFAULT NULL,
    user_role TEXT DEFAULT NULL,
    user_profile_id UUID DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    appointment_data JSONB,
    total_count BIGINT
) 
LANGUAGE sql
SECURITY DEFINER
AS $function$
    WITH filtered_appointments AS (
        SELECT 
            jsonb_build_object(
                'id', a.id,
                'patient_id', a.patient_id,
                'doctor_id', a.doctor_id,
                'appointment_date', a.appointment_date,
                'appointment_time', a.appointment_time,
                'duration_minutes', a.duration_minutes,
                'status', a.status,
                'reason', a.reason,
                'notes', a.notes,
                'diagnosis', a.diagnosis,
                'treatment_plan', a.treatment_plan,
                'no_show_reason', a.no_show_reason,
                'session_deducted', a.session_deducted,
                'pardoned_by', a.pardoned_by,
                'pardoned_at', a.pardoned_at,
                'pardon_reason', a.pardon_reason,
                'rescheduled_from_id', a.rescheduled_from_id,
                'rescheduled_to_id', a.rescheduled_to_id,
                'rescheduled_at', a.rescheduled_at,
                'rescheduled_by', a.rescheduled_by,
                'reschedule_reason', a.reschedule_reason,
                'created_at', a.created_at,
                'updated_at', a.updated_at,
                'patient', jsonb_build_object(
                    'id', p.id,
                    'profile', jsonb_build_object(
                        'first_name', pp.first_name,
                        'last_name', pp.last_name,
                        'dni', pp.dni
                    )
                ),
                'doctor', jsonb_build_object(
                    'id', d.id,
                    'profile', jsonb_build_object(
                        'first_name', dp.first_name,
                        'last_name', dp.last_name
                    ),
                    'specialty', jsonb_build_object(
                        'name', s.name,
                        'color', s.color
                    )
                )
            ) as appointment_json
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
            AND (status_filter IS NULL OR status_filter = 'all' OR a.status::TEXT = status_filter)
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
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
    ),
    total_count_query AS (
        SELECT COUNT(*) as total_count FROM filtered_appointments
    ),
    paginated_results AS (
        SELECT appointment_json FROM filtered_appointments
        LIMIT limit_count OFFSET offset_count
    )
    SELECT 
        pr.appointment_json as appointment_data,
        tc.total_count
    FROM paginated_results pr
    CROSS JOIN total_count_query tc;
$function$