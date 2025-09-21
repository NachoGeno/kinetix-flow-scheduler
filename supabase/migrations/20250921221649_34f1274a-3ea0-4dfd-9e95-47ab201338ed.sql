-- Crear el índice único faltante para prevenir citas duplicadas
-- Este índice evita que se creen múltiples citas activas para el mismo doctor en el mismo horario
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_active 
ON appointments (doctor_id, appointment_date, appointment_time)
WHERE status NOT IN ('cancelled', 'discharged', 'completed', 'no_show', 'no_show_session_lost', 'rescheduled');