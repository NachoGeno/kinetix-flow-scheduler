-- CORRECCIÓN FINAL: Corregir TODOS los errores restantes
-- Incluir todas las diferencias sospechosas (más de 2 días)

-- Respaldar las citas restantes con errores
INSERT INTO appointments_backup 
SELECT * FROM appointments 
WHERE ABS(appointment_date::date - DATE(created_at)) > 2
AND notes NOT LIKE '%[FECHA CORREGIDA%'
AND NOT EXISTS (
    SELECT 1 FROM appointments_backup ab 
    WHERE ab.id = appointments.id
);

-- Corrección de TODOS los errores restantes (excepto diferencias de 1-2 días que pueden ser legítimas)
UPDATE appointments 
SET 
  appointment_date = DATE(created_at),
  updated_at = now(),
  notes = COALESCE(notes || ' ', '') || '[FECHA CORREGIDA - ERROR FINAL]'
WHERE ABS(appointment_date::date - DATE(created_at)) > 2
AND notes NOT LIKE '%[FECHA CORREGIDA%';