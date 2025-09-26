-- FASE 4: Vistas del Schema Reporting
-- 1. Vista de asistencia diaria
CREATE OR REPLACE VIEW reporting.vw_attendance_daily AS
SELECT 
    a.appointment_date,
    a.organization_id,
    COUNT(*) as total_appointments,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
    COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) as no_show_appointments,
    COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_appointments,
    ROUND(
        (COUNT(CASE WHEN a.status = 'completed' THEN 1 END)::numeric / 
         NULLIF(COUNT(*)::numeric, 0)) * 100, 2
    ) as attendance_rate
FROM appointments a
WHERE a.appointment_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY a.appointment_date, a.organization_id
ORDER BY a.appointment_date DESC;

-- 2. Vista de utilización de capacidad por profesional
CREATE OR REPLACE VIEW reporting.vw_capacity_utilization AS
SELECT 
    d.id as doctor_id,
    CONCAT(p.first_name, ' ', p.last_name) as doctor_name,
    s.name as specialty_name,
    d.organization_id,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as sessions_completed,
    COUNT(CASE WHEN a.status IN ('scheduled', 'confirmed') THEN 1 END) as sessions_scheduled,
    COUNT(*) as total_sessions,
    ROUND(
        (COUNT(CASE WHEN a.status = 'completed' THEN 1 END)::numeric / 
         NULLIF(COUNT(*)::numeric, 0)) * 100, 2
    ) as completion_rate,
    DATE_TRUNC('month', a.appointment_date) as period_month
FROM doctors d
JOIN profiles p ON d.profile_id = p.id
JOIN specialties s ON d.specialty_id = s.id
LEFT JOIN appointments a ON d.id = a.doctor_id 
    AND a.appointment_date >= CURRENT_DATE - INTERVAL '90 days'
WHERE d.is_active = true
GROUP BY d.id, p.first_name, p.last_name, s.name, d.organization_id, DATE_TRUNC('month', a.appointment_date)
ORDER BY sessions_completed DESC;