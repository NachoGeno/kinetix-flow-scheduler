-- ========================================
-- MIGRACIÓN: Aislamiento Organizacional en Funciones RPC de Reports
-- ========================================
-- Esta migración elimina y recrea las funciones RPC con filtros de organization_id

-- Paso 1: Eliminar funciones existentes
DROP FUNCTION IF EXISTS public.get_patients_attended_by_month(DATE, DATE, UUID);
DROP FUNCTION IF EXISTS public.get_new_patients_by_month(DATE, DATE);
DROP FUNCTION IF EXISTS public.get_active_patients_in_treatment();
DROP FUNCTION IF EXISTS public.get_patients_without_closed_history();
DROP FUNCTION IF EXISTS public.get_professional_work_hours(DATE, DATE);
DROP FUNCTION IF EXISTS public.get_appointments_by_time_slot(DATE, DATE, UUID);
DROP FUNCTION IF EXISTS public.get_patients_by_doctor(DATE, DATE);

-- Paso 2: Recrear funciones con filtros organizacionales

-- 1. get_patients_attended_by_month
CREATE FUNCTION public.get_patients_attended_by_month(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    doctor_filter UUID DEFAULT NULL
)
RETURNS TABLE(
    month TEXT,
    patients_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        TO_CHAR(a.appointment_date, 'YYYY-MM') as month,
        COUNT(DISTINCT a.patient_id) as patients_count
    FROM appointments a
    WHERE a.status = 'completed'
        AND a.organization_id = get_current_user_organization_id()
        AND (start_date IS NULL OR a.appointment_date >= start_date)
        AND (end_date IS NULL OR a.appointment_date <= end_date)
        AND (doctor_filter IS NULL OR a.doctor_id = doctor_filter)
    GROUP BY TO_CHAR(a.appointment_date, 'YYYY-MM')
    ORDER BY month;
$$;

-- 2. get_new_patients_by_month
CREATE FUNCTION public.get_new_patients_by_month(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
RETURNS TABLE(
    month TEXT,
    new_patients_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        TO_CHAR(p.created_at, 'YYYY-MM') as month,
        COUNT(p.id) as new_patients_count
    FROM patients p
    WHERE p.is_active = true
        AND p.organization_id = get_current_user_organization_id()
        AND (start_date IS NULL OR p.created_at::DATE >= start_date)
        AND (end_date IS NULL OR p.created_at::DATE <= end_date)
    GROUP BY TO_CHAR(p.created_at, 'YYYY-MM')
    ORDER BY month;
$$;

-- 3. get_active_patients_in_treatment
CREATE FUNCTION public.get_active_patients_in_treatment()
RETURNS TABLE(
    patient_id UUID,
    patient_name TEXT,
    active_orders_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        p.id as patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) as patient_name,
        COUNT(mo.id) as active_orders_count
    FROM patients p
    INNER JOIN profiles pr ON p.profile_id = pr.id
    LEFT JOIN medical_orders mo ON p.id = mo.patient_id 
        AND mo.completed = false
        AND mo.organization_id = get_current_user_organization_id()
    WHERE p.is_active = true
        AND p.organization_id = get_current_user_organization_id()
    GROUP BY p.id, pr.first_name, pr.last_name
    HAVING COUNT(mo.id) > 0
    ORDER BY active_orders_count DESC, patient_name;
$$;

-- 4. get_patients_without_closed_history
CREATE FUNCTION public.get_patients_without_closed_history()
RETURNS TABLE(
    patient_id UUID,
    patient_name TEXT,
    last_appointment_date DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        p.id as patient_id,
        CONCAT(pr.first_name, ' ', pr.last_name) as patient_name,
        MAX(a.appointment_date) as last_appointment_date
    FROM patients p
    INNER JOIN profiles pr ON p.profile_id = pr.id
    INNER JOIN appointments a ON p.id = a.patient_id
    WHERE p.is_active = true
        AND p.organization_id = get_current_user_organization_id()
        AND a.status = 'completed'
        AND a.organization_id = get_current_user_organization_id()
        AND NOT EXISTS (
            SELECT 1 
            FROM unified_medical_histories umh
            WHERE umh.patient_id = p.id
                AND umh.organization_id = get_current_user_organization_id()
                AND umh.template_data->>'final_summary' IS NOT NULL
        )
    GROUP BY p.id, pr.first_name, pr.last_name
    ORDER BY last_appointment_date DESC;
$$;

-- 5. get_professional_work_hours
CREATE FUNCTION public.get_professional_work_hours(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
RETURNS TABLE(
    doctor_id UUID,
    doctor_name TEXT,
    specialty_name TEXT,
    total_hours NUMERIC,
    total_sessions BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        d.id as doctor_id,
        CONCAT(pr.first_name, ' ', pr.last_name) as doctor_name,
        s.name as specialty_name,
        COALESCE(SUM(a.duration_minutes) / 60.0, 0) as total_hours,
        COUNT(a.id) as total_sessions
    FROM doctors d
    INNER JOIN profiles pr ON d.profile_id = pr.id
    INNER JOIN specialties s ON d.specialty_id = s.id
    LEFT JOIN appointments a ON d.id = a.doctor_id 
        AND a.status = 'completed'
        AND a.organization_id = get_current_user_organization_id()
        AND (start_date IS NULL OR a.appointment_date >= start_date)
        AND (end_date IS NULL OR a.appointment_date <= end_date)
    WHERE d.is_active = true
        AND d.organization_id = get_current_user_organization_id()
    GROUP BY d.id, pr.first_name, pr.last_name, s.name
    ORDER BY total_hours DESC;
$$;

-- 6. get_appointments_by_time_slot (CORREGIDO: repetir CASE en GROUP BY y ORDER BY)
CREATE FUNCTION public.get_appointments_by_time_slot(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    doctor_filter UUID DEFAULT NULL
)
RETURNS TABLE(
    time_slot TEXT,
    appointments_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        CASE 
            WHEN EXTRACT(HOUR FROM a.appointment_time) < 12 THEN 'Mañana'
            WHEN EXTRACT(HOUR FROM a.appointment_time) < 18 THEN 'Tarde'
            ELSE 'Noche'
        END as time_slot,
        COUNT(a.id) as appointments_count
    FROM appointments a
    WHERE a.status IN ('completed', 'scheduled', 'confirmed')
        AND a.organization_id = get_current_user_organization_id()
        AND (start_date IS NULL OR a.appointment_date >= start_date)
        AND (end_date IS NULL OR a.appointment_date <= end_date)
        AND (doctor_filter IS NULL OR a.doctor_id = doctor_filter)
    GROUP BY 
        CASE 
            WHEN EXTRACT(HOUR FROM a.appointment_time) < 12 THEN 'Mañana'
            WHEN EXTRACT(HOUR FROM a.appointment_time) < 18 THEN 'Tarde'
            ELSE 'Noche'
        END
    ORDER BY 
        CASE 
            WHEN CASE 
                WHEN EXTRACT(HOUR FROM a.appointment_time) < 12 THEN 'Mañana'
                WHEN EXTRACT(HOUR FROM a.appointment_time) < 18 THEN 'Tarde'
                ELSE 'Noche'
            END = 'Mañana' THEN 1
            WHEN CASE 
                WHEN EXTRACT(HOUR FROM a.appointment_time) < 12 THEN 'Mañana'
                WHEN EXTRACT(HOUR FROM a.appointment_time) < 18 THEN 'Tarde'
                ELSE 'Noche'
            END = 'Tarde' THEN 2
            ELSE 3
        END;
$$;

-- 7. get_patients_by_doctor
CREATE FUNCTION public.get_patients_by_doctor(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
RETURNS TABLE(
    doctor_id UUID,
    doctor_name TEXT,
    patients_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        d.id as doctor_id,
        CONCAT(pr.first_name, ' ', pr.last_name) as doctor_name,
        COUNT(DISTINCT a.patient_id) as patients_count
    FROM doctors d
    INNER JOIN profiles pr ON d.profile_id = pr.id
    LEFT JOIN appointments a ON d.id = a.doctor_id 
        AND a.status = 'completed'
        AND a.organization_id = get_current_user_organization_id()
        AND (start_date IS NULL OR a.appointment_date >= start_date)
        AND (end_date IS NULL OR a.appointment_date <= end_date)
    WHERE d.is_active = true
        AND d.organization_id = get_current_user_organization_id()
    GROUP BY d.id, pr.first_name, pr.last_name
    ORDER BY patients_count DESC;
$$;

-- 8. get_appointment_stats - actualizar función existente
CREATE OR REPLACE FUNCTION public.get_appointment_stats(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    doctor_filter UUID DEFAULT NULL
)
RETURNS TABLE(
    status TEXT,
    count BIGINT,
    percentage NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
        ROUND((s.status_count::NUMERIC / NULLIF(t.total_appointments, 0)::NUMERIC) * 100, 2) as percentage
    FROM stats s
    CROSS JOIN total_count t
    ORDER BY s.status_count DESC;
$$;

-- 9. get_stats_by_obra_social - actualizar función existente
CREATE OR REPLACE FUNCTION public.get_stats_by_obra_social(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
RETURNS TABLE(
    obra_social_id UUID,
    obra_social_name TEXT,
    tipo insurance_type,
    pacientes_atendidos BIGINT,
    sesiones_realizadas BIGINT,
    ordenes_medicas BIGINT,
    costo_total NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        osa.id as obra_social_id,
        osa.nombre as obra_social_name,
        osa.tipo,
        COUNT(DISTINCT a.patient_id) as pacientes_atendidos,
        COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as sesiones_realizadas,
        COUNT(DISTINCT mo.id) as ordenes_medicas,
        COALESCE(SUM(CASE 
            WHEN a.status = 'completed' AND vh.valor_por_sesion IS NOT NULL 
            THEN vh.valor_por_sesion 
            ELSE 0 
        END), 0) as costo_total
    FROM obras_sociales_art osa
    LEFT JOIN patients p ON p.obra_social_art_id = osa.id
        AND p.organization_id = get_current_user_organization_id()
    LEFT JOIN appointments a ON a.patient_id = p.id
        AND a.organization_id = get_current_user_organization_id()
        AND (start_date IS NULL OR a.appointment_date >= start_date)
        AND (end_date IS NULL OR a.appointment_date <= end_date)
    LEFT JOIN medical_orders mo ON mo.patient_id = p.id
        AND mo.organization_id = get_current_user_organization_id()
        AND (start_date IS NULL OR mo.created_at::DATE >= start_date)
        AND (end_date IS NULL OR mo.created_at::DATE <= end_date)
    LEFT JOIN valores_honorarios vh ON vh.doctor_id = a.doctor_id
        AND vh.is_active = true
        AND a.appointment_date >= vh.fecha_vigencia_desde
        AND (vh.fecha_vigencia_hasta IS NULL OR a.appointment_date <= vh.fecha_vigencia_hasta)
    WHERE osa.is_active = true
        AND osa.organization_id = get_current_user_organization_id()
    GROUP BY osa.id, osa.nombre, osa.tipo
    ORDER BY pacientes_atendidos DESC, sesiones_realizadas DESC;
$$;