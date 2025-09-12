-- Fix security issues by setting proper search_path for the functions
-- This addresses the search_path mutable security warnings

CREATE OR REPLACE FUNCTION public.search_appointments_paginated(
    search_term text DEFAULT NULL::text, 
    status_filter text DEFAULT NULL::text, 
    date_from date DEFAULT NULL::date, 
    date_to date DEFAULT NULL::date, 
    user_role text DEFAULT NULL::text, 
    user_profile_id uuid DEFAULT NULL::uuid, 
    limit_count integer DEFAULT 50, 
    offset_count integer DEFAULT 0
)
RETURNS TABLE(appointment_data jsonb, total_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
            -- CRITICAL: Organization isolation - only show appointments from current user's organization
            a.organization_id = get_current_user_organization_id()
            -- Role-based filtering
            AND CASE 
                WHEN user_role = 'patient' THEN p.profile_id = user_profile_id
                WHEN user_role = 'doctor' THEN d.profile_id = user_profile_id
                ELSE TRUE -- admin can see all appointments within their organization
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
$function$;

CREATE OR REPLACE FUNCTION public.get_appointment_stats(
    start_date date DEFAULT NULL::date, 
    end_date date DEFAULT NULL::date, 
    doctor_filter uuid DEFAULT NULL::uuid
)
RETURNS TABLE(status text, count bigint, percentage numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH stats AS (
    SELECT 
      a.status::TEXT as appointment_status,
      COUNT(*) as status_count
    FROM appointments a
    WHERE 
      a.organization_id = get_current_user_organization_id()
      AND (start_date IS NULL OR a.appointment_date >= start_date)
      AND (end_date IS NULL OR a.appointment_date <= end_date)
      AND (doctor_filter IS NULL OR a.doctor_id = doctor_filter)
    GROUP BY a.status
  ),
  total_count AS (
    SELECT SUM(status_count) as total_appointments
    FROM stats
  )
  SELECT 
    s.appointment_status as status,
    s.status_count as count,
    ROUND((s.status_count::NUMERIC / t.total_appointments::NUMERIC) * 100, 2) as percentage
  FROM stats s
  CROSS JOIN total_count t
  ORDER BY s.status_count DESC;
$function$;