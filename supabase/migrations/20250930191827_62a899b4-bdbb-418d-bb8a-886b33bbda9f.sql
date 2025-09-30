-- Security Fix Part 2: Add SET search_path = public to remaining 11 SECURITY DEFINER functions
-- Zero risk: Only adds security layer without changing any logic

-- 1. fix_medical_orders_data_integrity
CREATE OR REPLACE FUNCTION public.fix_medical_orders_data_integrity()
RETURNS TABLE(order_id uuid, patient_name text, old_sessions_used integer, new_sessions_used integer, old_completed boolean, new_completed boolean, action_taken text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    patient_rec RECORD;
    order_rec RECORD;
    session_rec RECORD;
    current_sessions_assigned INTEGER := 0;
    sessions_for_this_order INTEGER := 0;
    should_be_completed BOOLEAN;
    sessions_from_previous_orders INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting CORRECTED medical orders data integrity fix...';
    
    FOR patient_rec IN 
        SELECT DISTINCT 
            mo.patient_id,
            CONCAT(p.first_name, ' ', p.last_name) as patient_name
        FROM medical_orders mo
        JOIN patients pt ON mo.patient_id = pt.id
        JOIN profiles p ON pt.profile_id = p.id
        ORDER BY patient_name
    LOOP
        current_sessions_assigned := 0;
        
        RAISE NOTICE 'Processing patient: %', patient_rec.patient_name;
        
        FOR order_rec IN 
            SELECT 
                mo.id,
                mo.patient_id,
                mo.sessions_used,
                mo.total_sessions,
                mo.completed,
                mo.created_at,
                mo.created_at::DATE as order_date,
                patient_rec.patient_name
            FROM medical_orders mo
            WHERE mo.patient_id = patient_rec.patient_id
            ORDER BY mo.created_at ASC
        LOOP
            sessions_for_this_order := 0;
            
            FOR session_rec IN 
                SELECT a.id, a.status, a.appointment_date
                FROM appointments a
                WHERE a.patient_id = order_rec.patient_id
                  AND a.appointment_date >= order_rec.order_date
                  AND a.status = 'completed'
                ORDER BY a.appointment_date ASC
            LOOP
                IF current_sessions_assigned < order_rec.total_sessions THEN
                    sessions_for_this_order := sessions_for_this_order + 1;
                    current_sessions_assigned := current_sessions_assigned + 1;
                END IF;
            END LOOP;
            
            should_be_completed := (sessions_for_this_order >= order_rec.total_sessions);
            
            IF order_rec.sessions_used != sessions_for_this_order OR 
               COALESCE(order_rec.completed, false) != should_be_completed THEN
                
                UPDATE medical_orders
                SET 
                    sessions_used = sessions_for_this_order,
                    completed = should_be_completed,
                    completed_at = CASE 
                        WHEN should_be_completed AND NOT COALESCE(completed, false)
                        THEN NOW()
                        WHEN NOT should_be_completed AND COALESCE(completed, false)
                        THEN NULL
                        ELSE completed_at
                    END,
                    updated_at = NOW()
                WHERE id = order_rec.id;
                
                RETURN QUERY SELECT 
                    order_rec.id,
                    order_rec.patient_name,
                    order_rec.sessions_used,
                    sessions_for_this_order,
                    COALESCE(order_rec.completed, false),
                    should_be_completed,
                    'Corrected sessions_used and completed status'::text;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN;
END;
$function$;

-- 2. get_active_patients_in_treatment
CREATE OR REPLACE FUNCTION public.get_active_patients_in_treatment(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, obra_social_filter uuid DEFAULT NULL::uuid)
RETURNS TABLE(patient_id uuid, patient_name text, obra_social_name text, active_orders bigint, last_appointment_date date)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

-- 3. get_appointments_by_time_slot
CREATE OR REPLACE FUNCTION public.get_appointments_by_time_slot(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, doctor_filter uuid DEFAULT NULL::uuid)
RETURNS TABLE(time_slot text, total_appointments bigint, completed_appointments bigint, cancelled_appointments bigint, completion_rate numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

-- 4. get_new_patients_by_month
CREATE OR REPLACE FUNCTION public.get_new_patients_by_month(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, obra_social_filter uuid DEFAULT NULL::uuid)
RETURNS TABLE(year integer, month integer, month_name text, new_patients bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

-- 5. get_patients_attended_by_month
CREATE OR REPLACE FUNCTION public.get_patients_attended_by_month(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, doctor_filter uuid DEFAULT NULL::uuid)
RETURNS TABLE(year integer, month integer, month_name text, patients_attended bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

-- 6. get_patients_by_doctor
CREATE OR REPLACE FUNCTION public.get_patients_by_doctor(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date)
RETURNS TABLE(doctor_id uuid, doctor_name text, patients_attended bigint, percentage numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

-- 7. get_patients_without_closed_history
CREATE OR REPLACE FUNCTION public.get_patients_without_closed_history(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, obra_social_filter uuid DEFAULT NULL::uuid)
RETURNS TABLE(patient_id uuid, patient_name text, obra_social_name text, completed_sessions bigint, has_final_summary boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

-- 8. get_professional_work_hours
CREATE OR REPLACE FUNCTION public.get_professional_work_hours(start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date, doctor_filter uuid DEFAULT NULL::uuid)
RETURNS TABLE(doctor_id uuid, doctor_name text, specialty_name text, patients_attended bigint, appointments_completed bigint, estimated_hours numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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

-- 9. handle_assignment_changes
CREATE OR REPLACE FUNCTION public.handle_assignment_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM recalc_order_sessions(NEW.medical_order_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM recalc_order_sessions(OLD.medical_order_id);
    ELSIF TG_OP = 'UPDATE' AND OLD.medical_order_id IS DISTINCT FROM NEW.medical_order_id THEN
        PERFORM recalc_order_sessions(OLD.medical_order_id);
        PERFORM recalc_order_sessions(NEW.medical_order_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 10. recalc_patient_order_sessions_with_assignments
CREATE OR REPLACE FUNCTION public.recalc_patient_order_sessions_with_assignments(patient_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    order_record RECORD;
BEGIN
    FOR order_record IN 
        SELECT id FROM medical_orders 
        WHERE patient_id = patient_uuid
        ORDER BY created_at ASC
    LOOP
        PERFORM recalc_order_sessions(order_record.id);
    END LOOP;
    
    RAISE NOTICE 'Recalculadas todas las órdenes para paciente %', patient_uuid;
END;
$function$;

-- 11. validate_order_capacity_before_assignment
CREATE OR REPLACE FUNCTION public.validate_order_capacity_before_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_validation_result jsonb;
    v_skip_auto_assign text;
BEGIN
    v_skip_auto_assign := current_setting('app.skip_auto_assign', true);
    
    IF v_skip_auto_assign = 'true' THEN
        RAISE NOTICE 'Skipping auto-assignment validation per session flag';
        RETURN NEW;
    END IF;
    
    SELECT validate_order_assignment_capacity(NEW.medical_order_id, 1)
    INTO v_validation_result;
    
    IF NOT (v_validation_result->>'valid')::boolean THEN
        RAISE EXCEPTION 'ASSIGNMENT_VALIDATION_FAILED: %', v_validation_result->>'message';
    END IF;
    
    RETURN NEW;
END;
$function$;