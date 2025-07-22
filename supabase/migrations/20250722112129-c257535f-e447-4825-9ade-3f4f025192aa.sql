-- Agregar foreign key que falta entre progress_notes y appointments
ALTER TABLE public.progress_notes 
ADD CONSTRAINT progress_notes_appointment_id_fkey 
FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;