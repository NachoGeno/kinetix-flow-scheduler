-- Create the missing unique partial index for preventing duplicate active appointments
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_active
ON public.appointments (doctor_id, appointment_date, appointment_time, patient_id, organization_id)
WHERE status IN ('scheduled', 'confirmed', 'in_progress');