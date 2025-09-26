-- Vistas restantes del Schema Reporting
-- 3. Vista de pipeline de órdenes médicas
CREATE OR REPLACE VIEW reporting.vw_orders_pipeline AS
SELECT 
    mo.id as order_id,
    mo.organization_id,
    CONCAT(pt_profile.first_name, ' ', pt_profile.last_name) as patient_name,
    CONCAT(dr_profile.first_name, ' ', dr_profile.last_name) as doctor_name,
    mo.order_type,
    mo.total_sessions,
    mo.sessions_used,
    get_active_assignments_count(mo.id) as active_assignments,
    (mo.total_sessions - get_active_assignments_count(mo.id)) as sessions_remaining,
    mo.document_status,
    mo.presentation_status,
    mo.completed,
    mo.urgent,
    mo.order_date,
    osa.nombre as obra_social_name,
    CASE 
        WHEN mo.completed THEN 'Completada'
        WHEN get_active_assignments_count(mo.id) >= mo.total_sessions THEN 'Sesiones Asignadas'
        WHEN get_active_assignments_count(mo.id) > 0 THEN 'En Progreso'
        ELSE 'Pendiente Asignación'
    END as pipeline_status
FROM medical_orders mo
JOIN patients pt ON mo.patient_id = pt.id
JOIN profiles pt_profile ON pt.profile_id = pt_profile.id
LEFT JOIN doctors dr ON mo.doctor_id = dr.id
LEFT JOIN profiles dr_profile ON dr.profile_id = dr_profile.id
LEFT JOIN obras_sociales_art osa ON mo.obra_social_art_id = osa.id
WHERE mo.order_date >= CURRENT_DATE - INTERVAL '180 days'
ORDER BY mo.order_date DESC, mo.urgent DESC;

-- 4. Vista de KPIs principales unificados
CREATE OR REPLACE VIEW reporting.vw_kpi_core AS
SELECT 
    org.id as organization_id,
    org.name as organization_name,
    CURRENT_DATE as report_date,
    
    -- KPIs de asistencia
    (SELECT COUNT(*) FROM appointments a 
     WHERE a.organization_id = org.id 
     AND a.appointment_date = CURRENT_DATE
     AND a.status = 'completed') as today_completed_appointments,
     
    (SELECT COUNT(*) FROM appointments a 
     WHERE a.organization_id = org.id 
     AND a.appointment_date = CURRENT_DATE) as today_total_appointments,
     
    -- KPIs de órdenes
    (SELECT COUNT(*) FROM medical_orders mo 
     WHERE mo.organization_id = org.id 
     AND mo.completed = false) as active_orders,
     
    (SELECT COUNT(*) FROM medical_orders mo 
     WHERE mo.organization_id = org.id 
     AND mo.document_status = 'pendiente') as pending_docs,
     
    -- KPIs de pacientes
    (SELECT COUNT(*) FROM patients p 
     WHERE p.organization_id = org.id 
     AND p.is_active = true) as active_patients,
     
    (SELECT COUNT(*) FROM patients p 
     WHERE p.organization_id = org.id 
     AND p.created_at::date >= CURRENT_DATE - INTERVAL '30 days') as new_patients_month

FROM organizations org
WHERE org.is_active = true;

-- Otorgar permisos de SELECT en las vistas al rol report_reader
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO report_reader;