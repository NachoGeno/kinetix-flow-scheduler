-- Create progress_notes table
CREATE TABLE public.progress_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  medical_order_id UUID,
  content TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  note_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'structured', 'image'
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'final'
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to ensure one progress note per appointment
ALTER TABLE public.progress_notes 
ADD CONSTRAINT unique_progress_note_per_appointment 
UNIQUE (appointment_id);

-- Enable RLS
ALTER TABLE public.progress_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for progress notes
CREATE POLICY "Admins can manage all progress notes" 
ON public.progress_notes 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Doctors can manage their progress notes" 
ON public.progress_notes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    JOIN profiles p ON d.profile_id = p.id
    WHERE a.id = progress_notes.appointment_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Patients can view their progress notes" 
ON public.progress_notes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM patients p
    JOIN profiles pr ON p.profile_id = pr.id
    WHERE p.id = progress_notes.patient_id 
    AND pr.user_id = auth.uid()
  )
);

CREATE POLICY "Other roles can view progress notes" 
ON public.progress_notes 
FOR SELECT 
USING (get_user_role(auth.uid()) IN ('receptionist', 'auditor'));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_progress_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_progress_notes_updated_at
BEFORE UPDATE ON public.progress_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_progress_notes_updated_at();

-- Add foreign key constraints (optional, for data integrity)
ALTER TABLE public.progress_notes 
ADD CONSTRAINT fk_progress_notes_patient 
FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.progress_notes 
ADD CONSTRAINT fk_progress_notes_appointment 
FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;