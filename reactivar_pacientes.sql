-- Script para reactivar todos los pacientes inactivos
-- Esto evita problemas con órdenes médicas y citas existentes

-- 1. Ver cuántos pacientes están inactivos antes del cambio
SELECT 
    COUNT(*) as pacientes_inactivos,
    string_agg(pr.first_name || ' ' || pr.last_name, ', ') as nombres
FROM patients p
JOIN profiles pr ON p.profile_id = pr.id
WHERE p.is_active = false;

-- 2. Reactivar todos los pacientes inactivos
UPDATE patients 
SET is_active = true, 
    updated_at = NOW()
WHERE is_active = false;

-- 3. Verificar que todos los pacientes están activos
SELECT 
    COUNT(*) as total_pacientes,
    COUNT(CASE WHEN is_active = true THEN 1 END) as pacientes_activos,
    COUNT(CASE WHEN is_active = false THEN 1 END) as pacientes_inactivos
FROM patients;

-- 4. Mostrar los pacientes que fueron reactivados
SELECT 
    p.id,
    pr.first_name,
    pr.last_name,
    p.updated_at as fecha_reactivacion
FROM patients p
JOIN profiles pr ON p.profile_id = pr.id
WHERE p.updated_at >= NOW() - INTERVAL '1 minute'
ORDER BY p.updated_at DESC;
