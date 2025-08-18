-- Create audit log table for no-show resets
CREATE TABLE public.patient_noshow_resets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  reset_by UUID NOT NULL,
  reset_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  appointments_affected INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add field to appointments to mark pardoned no-shows
ALTER TABLE public.appointments 
ADD COLUMN pardoned_by UUID,
ADD COLUMN pardoned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN pardon_reason TEXT;

-- Enable RLS on the new table
ALTER TABLE public.patient_noshow_resets ENABLE ROW LEVEL SECURITY;

-- Create policies for the audit table
CREATE POLICY "Admins and reception can manage noshow resets" 
ON public.patient_noshow_resets 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('admin', 'reception')
  )
);

CREATE POLICY "Doctors can view noshow resets" 
ON public.patient_noshow_resets 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'doctor'
  )
);