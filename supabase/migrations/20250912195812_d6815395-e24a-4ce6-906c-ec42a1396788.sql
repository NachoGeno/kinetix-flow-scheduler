-- LIMPIEZA FINAL DE DUPLICADOS RESTANTES
-- Método más agresivo para eliminar todos los duplicados

-- Crear tabla temporal con los turnos únicos (más reciente de cada grupo)
CREATE TEMP TABLE final_appointments_to_keep AS
WITH ranked_appointments AS (
  SELECT 
    id,
    patient_id,
    doctor_id,
    appointment_date,
    appointment_time,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY patient_id, doctor_id, appointment_date, appointment_time 
      ORDER BY created_at DESC
    ) as rn
  FROM appointments
)
SELECT id FROM ranked_appointments WHERE rn = 1;

-- Limpiar cualquier referencia a los turnos que vamos a eliminar
UPDATE appointments 
SET rescheduled_from_id = NULL, rescheduled_to_id = NULL
WHERE id NOT IN (SELECT id FROM final_appointments_to_keep);

-- Respaldar turnos duplicados finales
INSERT INTO appointments_backup 
SELECT * FROM appointments 
WHERE id NOT IN (SELECT id FROM final_appointments_to_keep)
AND NOT EXISTS (
    SELECT 1 FROM appointments_backup ab 
    WHERE ab.id = appointments.id
);

-- Eliminar definitivamente todos los turnos duplicados
DELETE FROM appointments 
WHERE id NOT IN (SELECT id FROM final_appointments_to_keep);

-- Limpiar tabla temporal
DROP TABLE final_appointments_to_keep;