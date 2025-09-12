-- ELIMINAR TURNOS DUPLICADOS DE FORMA SEGURA
-- Versión mejorada que maneja las restricciones de clave foránea

-- 1. Primero, crear tabla temporal con los turnos a conservar (el más reciente de cada grupo)
CREATE TEMP TABLE appointments_to_keep AS
SELECT DISTINCT ON (patient_id, doctor_id, appointment_date, appointment_time)
    id
FROM appointments 
ORDER BY patient_id, doctor_id, appointment_date, appointment_time, created_at DESC;

-- 2. Actualizar las referencias de reagendamiento antes de eliminar
-- Redirigir referencias que apunten a turnos duplicados hacia el turno que se va a conservar
UPDATE appointments 
SET rescheduled_from_id = (
    SELECT id FROM appointments_to_keep 
    WHERE id IN (
        SELECT a.id FROM appointments a 
        WHERE a.patient_id = appointments.patient_id
        AND a.doctor_id = (SELECT doctor_id FROM appointments WHERE id = appointments.rescheduled_from_id)
        AND a.appointment_date = (SELECT appointment_date FROM appointments WHERE id = appointments.rescheduled_from_id)
        AND a.appointment_time = (SELECT appointment_time FROM appointments WHERE id = appointments.rescheduled_from_id)
        LIMIT 1
    )
)
WHERE rescheduled_from_id IS NOT NULL 
AND rescheduled_from_id NOT IN (SELECT id FROM appointments_to_keep);

-- 3. Limpiar referencias circulares o inválidas
UPDATE appointments 
SET rescheduled_to_id = NULL
WHERE rescheduled_to_id NOT IN (SELECT id FROM appointments_to_keep);

UPDATE appointments 
SET rescheduled_from_id = NULL
WHERE rescheduled_from_id NOT IN (SELECT id FROM appointments_to_keep);

-- 4. Respaldar turnos duplicados que se van a eliminar
INSERT INTO appointments_backup 
SELECT * FROM appointments 
WHERE id NOT IN (SELECT id FROM appointments_to_keep)
AND NOT EXISTS (
    SELECT 1 FROM appointments_backup ab 
    WHERE ab.id = appointments.id
);

-- 5. Eliminar los turnos duplicados
DELETE FROM appointments 
WHERE id NOT IN (SELECT id FROM appointments_to_keep);

-- 6. Limpiar tabla temporal
DROP TABLE appointments_to_keep;