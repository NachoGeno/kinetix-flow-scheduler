-- 1. Verificar si Carina Quiroz existe pero está inactiva
SELECT 
    p.id,
    pr.first_name,
    pr.last_name,
    p.is_active,
    p.created_at,
    p.updated_at
FROM patients p
JOIN profiles pr ON p.profile_id = pr.id
WHERE (pr.first_name ILIKE '%carina%' AND pr.last_name ILIKE '%quiroz%')
   OR (pr.first_name ILIKE '%quiroz%' AND pr.last_name ILIKE '%carina%');

-- 2. Órdenes médicas para pacientes inactivos
SELECT 
    mo.id as order_id,
    mo.patient_id,
    pr.first_name,
    pr.last_name,
    p.is_active,
    mo.description,
    mo.completed,
    mo.created_at
FROM medical_orders mo
JOIN patients p ON mo.patient_id = p.id
JOIN profiles pr ON p.profile_id = pr.id
WHERE p.is_active = false
ORDER BY mo.created_at DESC;

-- 2. Buscar específicamente órdenes relacionadas con Carina Quiroz
SELECT 
    mo.id as order_id,
    mo.patient_id,
    mo.description,
    mo.completed,
    mo.created_at
FROM medical_orders mo
WHERE mo.description ILIKE '%carina%' OR mo.description ILIKE '%quiroz%'
ORDER BY mo.created_at DESC;

-- 3. Contar total de órdenes huérfanas por organización
SELECT 
    mo.organization_id,
    COUNT(*) as ordenes_huerfanas
FROM medical_orders mo
LEFT JOIN patients p ON mo.patient_id = p.id
WHERE p.id IS NULL
GROUP BY mo.organization_id;

-- SOLUCIÓN TEMPORAL: Eliminar órdenes huérfanas
-- (EJECUTAR SOLO DESPUÉS DE REVISAR LOS RESULTADOS ANTERIORES)
/*
DELETE FROM medical_orders 
WHERE id IN (
    SELECT mo.id
    FROM medical_orders mo
    LEFT JOIN patients p ON mo.patient_id = p.id
    WHERE p.id IS NULL
);
*/
