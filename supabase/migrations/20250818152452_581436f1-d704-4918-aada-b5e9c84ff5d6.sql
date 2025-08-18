-- Security Fix 1: Remove public access to obras_sociales_art and restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can view active obras_sociales_art" ON obras_sociales_art;

CREATE POLICY "Authenticated users can view active obras_sociales_art" 
ON obras_sociales_art 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- Security Fix 2: Prevent users from updating their own role (privilege escalation)
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile (except role)" 
ON profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND (OLD.role = NEW.role OR is_admin(auth.uid())));

-- Security Fix 3: Secure all database functions with proper search_path
CREATE OR REPLACE FUNCTION public.get_patients_attended_by_month(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, doctor_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(year integer, month integer, month_name text, patients_attended bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT 
    EXTRACT(YEAR FROM a.appointment_date)::INTEGER as year,
    EXTRACT(MONTH FROM a.appointment_date)::INTEGER as month,
    TO_CHAR(a.appointment_date, 'Month') as month_name,
    COUNT(DISTINCT a.patient_id) as patients_attended
  FROM appointments a
  WHERE 
    a.status = 'completed'
    AND (start_date IS NULL OR a.appointment_date >= start_date)
    AND (end_date IS NULL OR a.appointment_date <= end_date)
    AND (doctor_filter IS NULL OR a.doctor_id = doctor_filter)
  GROUP BY 
    EXTRACT(YEAR FROM a.appointment_date),
    EXTRACT(MONTH FROM a.appointment_date),
    TO_CHAR(a.appointment_date, 'Month')
  ORDER BY year DESC, month DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_patients_by_doctor(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date)
 RETURNS TABLE(doctor_id uuid, doctor_name text, patients_attended bigint, percentage numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  WITH attended_stats AS (
    SELECT 
      a.doctor_id,
      COUNT(DISTINCT a.patient_id) as patients_count
    FROM appointments a
    WHERE 
      a.status = 'completed'
      AND (start_date IS NULL OR a.appointment_date >= start_date)
      AND (end_date IS NULL OR a.appointment_date <= end_date)
    GROUP BY a.doctor_id
  ),
  total_patients AS (
    SELECT SUM(patients_count) as total_count
    FROM attended_stats
  )
  SELECT 
    s.doctor_id,
    CONCAT(p.first_name, ' ', p.last_name) as doctor_name,
    s.patients_count as patients_attended,
    ROUND((s.patients_count::NUMERIC / t.total_count::NUMERIC) * 100, 2) as percentage
  FROM attended_stats s
  CROSS JOIN total_patients t
  JOIN doctors d ON d.id = s.doctor_id
  JOIN profiles p ON p.id = d.profile_id
  ORDER BY s.patients_count DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_appointment_stats(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, doctor_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(status text, count bigint, percentage numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  WITH stats AS (
    SELECT 
      a.status::TEXT as appointment_status,
      COUNT(*) as status_count
    FROM appointments a
    WHERE 
      (start_date IS NULL OR a.appointment_date >= start_date)
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

CREATE OR REPLACE FUNCTION public.get_new_patients_by_month(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, obra_social_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(year integer, month integer, month_name text, new_patients bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.get_active_patients_in_treatment(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, obra_social_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(patient_id uuid, patient_name text, obra_social_name text, active_orders bigint, last_appointment_date date)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.get_patients_without_closed_history(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, obra_social_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(patient_id uuid, patient_name text, obra_social_name text, completed_sessions bigint, has_final_summary boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.get_professional_work_hours(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, doctor_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(doctor_id uuid, doctor_name text, specialty_name text, patients_attended bigint, appointments_completed bigint, estimated_hours numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.get_appointments_by_time_slot(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, doctor_filter uuid DEFAULT NULL::uuid)
 RETURNS TABLE(time_slot text, total_appointments bigint, completed_appointments bigint, cancelled_appointments bigint, completion_rate numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.get_plus_payments_report(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, professional_filter uuid DEFAULT NULL::uuid, payment_method_filter payment_method DEFAULT NULL::payment_method)
 RETURNS TABLE(payment_id uuid, patient_name text, professional_name text, obra_social_name text, amount numeric, payment_method payment_method, payment_date date, observations text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
    SELECT 
        pp.id as payment_id,
        CONCAT(pt_profile.first_name, ' ', pt_profile.last_name) as patient_name,
        CASE 
            WHEN pp.professional_id IS NOT NULL 
            THEN CONCAT(prof_profile.first_name, ' ', prof_profile.last_name)
            ELSE 'Sin asignar'
        END as professional_name,
        osa.nombre as obra_social_name,
        pp.amount,
        pp.payment_method,
        pp.payment_date,
        pp.observations
    FROM plus_payments pp
    JOIN patients pt ON pp.patient_id = pt.id
    JOIN profiles pt_profile ON pt.profile_id = pt_profile.id
    LEFT JOIN obras_sociales_art osa ON pt.obra_social_art_id = osa.id
    LEFT JOIN doctors d ON pp.professional_id = d.id
    LEFT JOIN profiles prof_profile ON d.profile_id = prof_profile.id
    WHERE 
        (start_date IS NULL OR pp.payment_date >= start_date)
        AND (end_date IS NULL OR pp.payment_date <= end_date)
        AND (professional_filter IS NULL OR pp.professional_id = professional_filter)
        AND (payment_method_filter IS NULL OR pp.payment_method = payment_method_filter)
    ORDER BY pp.payment_date DESC, pp.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_plus_stats(target_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(total_amount numeric, cash_amount numeric, transfer_amount numeric, mercado_pago_amount numeric, total_payments bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
    SELECT 
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN amount ELSE 0 END), 0) as transfer_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'mercado_pago' THEN amount ELSE 0 END), 0) as mercado_pago_amount,
        COUNT(*) as total_payments
    FROM plus_payments 
    WHERE payment_date = target_date;
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_plus_payments()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'reception')
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
 RETURNS user_role
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT role FROM public.profiles WHERE profiles.user_id = $1;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = $1 AND role = 'admin'
  );
$function$;

-- Security Fix 4: Optionally restrict specialties to authenticated users (remove if business requires public access)
DROP POLICY IF EXISTS "Anyone can view specialties" ON specialties;

CREATE POLICY "Authenticated users can view specialties" 
ON specialties 
FOR SELECT 
TO authenticated
USING (true);