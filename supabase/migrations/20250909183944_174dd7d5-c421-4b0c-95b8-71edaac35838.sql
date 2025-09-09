-- Create new active medical order for Hugo García
INSERT INTO medical_orders (
    patient_id,
    description,
    order_type,
    total_sessions,
    sessions_used,
    completed,
    order_date,
    doctor_name,
    document_status,
    obra_social_art_id,
    organization_id
)
SELECT 
    '85512525-eedf-4269-93f5-db6aa72dff65'::UUID, -- Hugo's patient_id
    'Continuación tratamiento kinesiológico',
    'kinesiology'::order_type,
    10, -- 10 sessions
    0,  -- 0 sessions used initially
    false, -- not completed
    CURRENT_DATE,
    'MANUEL ANDRES GARCIA',
    'completa',
    '770a8cad-87ec-46b7-b8a7-a8d0d8fcd6d9'::UUID, -- His obra social
    'a0000000-0000-0000-0000-000000000001'::UUID  -- organization_id
WHERE NOT EXISTS (
    SELECT 1 FROM medical_orders 
    WHERE patient_id = '85512525-eedf-4269-93f5-db6aa72dff65'::UUID 
    AND completed = false
);

-- Verify the new order was created
SELECT 
    mo.id,
    mo.description,
    mo.total_sessions,
    mo.sessions_used,
    mo.completed,
    mo.created_at,
    CONCAT(p.first_name, ' ', p.last_name) as patient_name
FROM medical_orders mo
JOIN patients pt ON mo.patient_id = pt.id
JOIN profiles p ON pt.profile_id = p.id
WHERE p.first_name ILIKE '%Hugo%' AND p.last_name ILIKE '%Garcia%'
AND mo.completed = false;