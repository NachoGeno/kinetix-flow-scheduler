-- Función para obtener estadísticas de pacientes nuevos por mes
CREATE OR REPLACE FUNCTION public.get_new_patients_by_month(
  start_date date DEFAULT NULL::date, 
  end_date date DEFAULT NULL::date,
  obra_social_filter uuid DEFAULT NULL::uuid
)
RETURNS TABLE(year integer, month integer, month_name text, new_patients bigint)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT 
    EXTRACT(YEAR FROM p.created_at)::INTEGER as year,
    EXTRACT(MONTH FROM p.created_at)::INTEGER as month,
    TO_CHAR(p.created_at, 'Month') as month_name,
    COUNT(p.id) as new_patients
  FROM patients p
  WHERE 
    p.is_active = true
    AND (start_date IS NULL OR p.created_at::DATE >= start_date)
    AND (end_date IS NULL OR p.created_at::DATE <= end_date)
    AND (obra_social_filter IS NULL OR p.obra_social_art_id = obra_social_filter)
  GROUP BY 
    EXTRACT(YEAR FROM p.created_at),
    EXTRACT(MONTH FROM p.created_at),
    TO_CHAR(p.created_at, 'Month')
  ORDER BY year DESC, month DESC;
$function$;

-- Función para obtener pacientes activos en tratamiento
CREATE OR REPLACE FUNCTION public.get_active_patients_in_treatment(
  start_date date DEFAULT NULL::date, 
  end_date date DEFAULT NULL::date,
  obra_social_filter uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  patient_id uuid,
  patient_name text,
  obra_social_name text,
  active_orders bigint,
  last_appointment_date date
)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT 
    p.id as patient_id,
    CONCAT(pr.first_name, ' ', pr.last_name) as patient_name,
    osa.nombre as obra_social_name,
    COUNT(mo.id) as active_orders,
    MAX(a.appointment_date) as last_appointment_date
  FROM patients p
  JOIN profiles pr ON pr.id = p.profile_id
  LEFT JOIN obras_sociales_art osa ON osa.id = p.obra_social_art_id
  LEFT JOIN medical_orders mo ON mo.patient_id = p.id AND mo.completed = false
  LEFT JOIN appointments a ON a.patient_id = p.id
  WHERE 
    p.is_active = true
    AND (start_date IS NULL OR a.appointment_date >= start_date OR a.appointment_date IS NULL)
    AND (end_date IS NULL OR a.appointment_date <= end_date OR a.appointment_date IS NULL)
    AND (obra_social_filter IS NULL OR p.obra_social_art_id = obra_social_filter)
  GROUP BY p.id, pr.first_name, pr.last_name, osa.nombre
  HAVING COUNT(mo.id) > 0
  ORDER BY last_appointment_date DESC NULLS LAST;
$function$;

-- Función para obtener pacientes sin historia clínica cerrada
CREATE OR REPLACE FUNCTION public.get_patients_without_closed_history(
  start_date date DEFAULT NULL::date, 
  end_date date DEFAULT NULL::date,
  obra_social_filter uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  patient_id uuid,
  patient_name text,
  obra_social_name text,
  completed_sessions bigint,
  has_final_summary boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT 
    p.id as patient_id,
    CONCAT(pr.first_name, ' ', pr.last_name) as patient_name,
    osa.nombre as obra_social_name,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_sessions,
    COALESCE(
      (umh.template_data->'final_summary') IS NOT NULL AND 
      (umh.template_data->'final_summary') != 'null'::jsonb, 
      false
    ) as has_final_summary
  FROM patients p
  JOIN profiles pr ON pr.id = p.profile_id
  LEFT JOIN obras_sociales_art osa ON osa.id = p.obra_social_art_id
  LEFT JOIN appointments a ON a.patient_id = p.id
  LEFT JOIN medical_orders mo ON mo.patient_id = p.id AND mo.completed = true
  LEFT JOIN unified_medical_histories umh ON umh.medical_order_id = mo.id
  WHERE 
    p.is_active = true
    AND (start_date IS NULL OR a.appointment_date >= start_date OR a.appointment_date IS NULL)
    AND (end_date IS NULL OR a.appointment_date <= end_date OR a.appointment_date IS NULL)
    AND (obra_social_filter IS NULL OR p.obra_social_art_id = obra_social_filter)
  GROUP BY p.id, pr.first_name, pr.last_name, osa.nombre, umh.template_data
  HAVING 
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) > 0
    AND (
      COALESCE(
        (umh.template_data->'final_summary') IS NOT NULL AND 
        (umh.template_data->'final_summary') != 'null'::jsonb, 
        false
      ) = false
    )
  ORDER BY completed_sessions DESC;
$function$;

-- Función para obtener horas trabajadas estimadas por profesional
CREATE OR REPLACE FUNCTION public.get_professional_work_hours(
  start_date date DEFAULT NULL::date, 
  end_date date DEFAULT NULL::date,
  doctor_filter uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  doctor_id uuid,
  doctor_name text,
  specialty_name text,
  patients_attended bigint,
  appointments_completed bigint,
  estimated_hours numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT 
    d.id as doctor_id,
    CONCAT(p.first_name, ' ', p.last_name) as doctor_name,
    s.name as specialty_name,
    COUNT(DISTINCT a.patient_id) as patients_attended,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as appointments_completed,
    ROUND(
      (COUNT(CASE WHEN a.status = 'completed' THEN 1 END) * d.appointment_duration)::numeric / 60, 
      2
    ) as estimated_hours
  FROM doctors d
  JOIN profiles p ON p.id = d.profile_id
  JOIN specialties s ON s.id = d.specialty_id
  LEFT JOIN appointments a ON a.doctor_id = d.id
  WHERE 
    d.is_active = true
    AND (start_date IS NULL OR a.appointment_date >= start_date OR a.appointment_date IS NULL)
    AND (end_date IS NULL OR a.appointment_date <= end_date OR a.appointment_date IS NULL)
    AND (doctor_filter IS NULL OR d.id = doctor_filter)
  GROUP BY d.id, p.first_name, p.last_name, s.name, d.appointment_duration
  ORDER BY estimated_hours DESC NULLS LAST;
$function$;

-- Función para obtener turnos por horario
CREATE OR REPLACE FUNCTION public.get_appointments_by_time_slot(
  start_date date DEFAULT NULL::date, 
  end_date date DEFAULT NULL::date,
  doctor_filter uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  time_slot text,
  total_appointments bigint,
  completed_appointments bigint,
  cancelled_appointments bigint,
  completion_rate numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  WITH time_slots AS (
    SELECT 
      CASE 
        WHEN appointment_time >= '08:00:00' AND appointment_time < '12:00:00' THEN 'Mañana (08:00-12:00)'
        WHEN appointment_time >= '12:00:00' AND appointment_time < '16:00:00' THEN 'Tarde (12:00-16:00)'
        WHEN appointment_time >= '16:00:00' AND appointment_time < '20:00:00' THEN 'Noche (16:00-20:00)'
        ELSE 'Otro horario'
      END as time_slot,
      status
    FROM appointments a
    WHERE 
      (start_date IS NULL OR a.appointment_date >= start_date)
      AND (end_date IS NULL OR a.appointment_date <= end_date)
      AND (doctor_filter IS NULL OR a.doctor_id = doctor_filter)
  )
  SELECT 
    ts.time_slot,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN ts.status = 'completed' THEN 1 END) as completed_appointments,
    COUNT(CASE WHEN ts.status = 'cancelled' THEN 1 END) as cancelled_appointments,
    ROUND(
      (COUNT(CASE WHEN ts.status = 'completed' THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 
      2
    ) as completion_rate
  FROM time_slots ts
  GROUP BY ts.time_slot
  ORDER BY ts.time_slot;
$function$;