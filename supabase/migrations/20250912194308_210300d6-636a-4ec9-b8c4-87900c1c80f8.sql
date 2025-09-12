-- CORRECCIÓN MASIVA DE TODOS LOS ERRORES DE FECHA DETECTADOS
-- Esta vez corregir TODOS los desplazamientos sospechosos (8-15 días)

-- Paso 1: Respaldar TODAS las citas con errores de fecha antes de corregir
INSERT INTO appointments_backup 
SELECT * FROM appointments 
WHERE (appointment_date::date - DATE(created_at)) BETWEEN 8 AND 15
AND NOT EXISTS (
    SELECT 1 FROM appointments_backup ab 
    WHERE ab.id = appointments.id
);

-- Paso 2: CORRECCIÓN MASIVA de todas las citas con desplazamientos de 8-15 días
-- Cambiar appointment_date para que coincida con la fecha de creación
UPDATE appointments 
SET 
  appointment_date = DATE(created_at),
  updated_at = now(),
  notes = COALESCE(notes || ' ', '') || '[FECHA CORREGIDA - ERROR SISTEMÁTICO]'
WHERE (appointment_date::date - DATE(created_at)) BETWEEN 8 AND 15
AND (notes IS NULL OR notes NOT LIKE '%[FECHA CORREGIDA%');

-- Paso 3: Identificar y marcar citas duplicadas para revisión manual
-- No las eliminamos automáticamente por seguridad, solo las marcamos
UPDATE appointments 
SET notes = COALESCE(notes || ' ', '') || '[POSIBLE DUPLICADO - REVISAR]'
WHERE id IN (
    SELECT DISTINCT a1.id
    FROM appointments a1
    JOIN appointments a2 ON (
        a1.patient_id = a2.patient_id 
        AND a1.appointment_date = a2.appointment_date 
        AND a1.appointment_time = a2.appointment_time
        AND a1.id != a2.id
    )
    WHERE a1.notes NOT LIKE '%[POSIBLE DUPLICADO - REVISAR]%'
);