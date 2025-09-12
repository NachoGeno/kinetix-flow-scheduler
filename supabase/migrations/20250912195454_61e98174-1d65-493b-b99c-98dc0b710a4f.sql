-- ELIMINAR TURNOS DUPLICADOS
-- Conservar solo el turno más reciente (por created_at) de cada grupo duplicado

-- Primero crear una tabla temporal con los IDs de los turnos a conservar
CREATE TEMP TABLE appointments_to_keep AS
SELECT DISTINCT ON (patient_id, doctor_id, appointment_date, appointment_time)
    id
FROM appointments 
ORDER BY patient_id, doctor_id, appointment_date, appointment_time, created_at DESC;

-- Respaldar todos los turnos duplicados que se van a eliminar
INSERT INTO appointments_backup 
SELECT * FROM appointments 
WHERE id NOT IN (SELECT id FROM appointments_to_keep)
AND NOT EXISTS (
    SELECT 1 FROM appointments_backup ab 
    WHERE ab.id = appointments.id
);

-- Eliminar los turnos duplicados (conservar solo los que están en appointments_to_keep)
DELETE FROM appointments 
WHERE id NOT IN (SELECT id FROM appointments_to_keep);

-- Limpiar la tabla temporal
DROP TABLE appointments_to_keep;