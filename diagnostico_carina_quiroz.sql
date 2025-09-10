-- Diagnóstico del problema con Carina Quiroz
-- Buscar turnos huérfanos que apuntan a pacientes eliminados

-- 1. Buscar turnos con patient_id que no existe en la tabla patients
SELECT 
    a.id as appointment_id,
    a.patient_id,
    a.appointment_date,
    a.appointment_time,
    a.status,
    a.created_at,
    p.first_name,
    p.last_name
FROM appointments a
LEFT JOIN patients p ON a.patient_id = p.id
WHERE p.id IS NULL
ORDER BY a.created_at DESC;

-- 2. Buscar específicamente por "Carina" en appointments (si hay datos en JSON o texto)
SELECT 
    id,
    patient_id,
    appointment_date,
    appointment_time,
    status,
    notes
FROM appointments 
WHERE notes ILIKE '%carina%' OR notes ILIKE '%quiroz%'
ORDER BY created_at DESC;

-- 3. Buscar en medical_orders por si hay órdenes médicas huérfanas
SELECT 
    mo.id as order_id,
    mo.patient_id,
    mo.description,
    mo.created_at,
    p.first_name,
    p.last_name
FROM medical_orders mo
LEFT JOIN patients p ON mo.patient_id = p.id
WHERE p.id IS NULL
ORDER BY mo.created_at DESC;

-- 4. Verificar si existe algún paciente con nombre similar
SELECT 
    id,
    first_name,
    last_name,
    email,
    dni,
    is_active
FROM patients 
WHERE (first_name ILIKE '%carina%' OR last_name ILIKE '%quiroz%')
AND organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67'
ORDER BY created_at DESC;
