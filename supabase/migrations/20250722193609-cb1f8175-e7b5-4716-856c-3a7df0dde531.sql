-- Create unified medical history table
CREATE TABLE public.unified_medical_histories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medical_order_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  template_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create medical history entries table for session records
CREATE TABLE public.medical_history_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unified_medical_history_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  appointment_date DATE NOT NULL,
  professional_name TEXT NOT NULL,
  professional_id UUID NOT NULL,
  observations TEXT,
  evolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to ensure one unified history per medical order
ALTER TABLE public.unified_medical_histories 
ADD CONSTRAINT unique_unified_history_per_medical_order 
UNIQUE (medical_order_id);

-- Add unique constraint to ensure one entry per appointment
ALTER TABLE public.medical_history_entries 
ADD CONSTRAINT unique_entry_per_appointment 
UNIQUE (appointment_id);

-- Enable RLS
ALTER TABLE public.unified_medical_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_history_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for unified_medical_histories
CREATE POLICY "Admins can manage all unified medical histories" 
ON public.unified_medical_histories 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Doctors can manage their unified medical histories" 
ON public.unified_medical_histories 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM medical_orders mo
    JOIN doctors d ON mo.doctor_id = d.id
    JOIN profiles p ON d.profile_id = p.id
    WHERE mo.id = unified_medical_histories.medical_order_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Patients can view their unified medical histories" 
ON public.unified_medical_histories 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM patients p
    JOIN profiles pr ON p.profile_id = pr.id
    WHERE p.id = unified_medical_histories.patient_id 
    AND pr.user_id = auth.uid()
  )
);

-- Create policies for medical_history_entries
CREATE POLICY "Admins can manage all medical history entries" 
ON public.medical_history_entries 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Doctors can manage their medical history entries" 
ON public.medical_history_entries 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    JOIN profiles p ON d.profile_id = p.id
    WHERE a.id = medical_history_entries.appointment_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Patients can view their medical history entries" 
ON public.medical_history_entries 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM unified_medical_histories umh
    JOIN patients p ON umh.patient_id = p.id
    JOIN profiles pr ON p.profile_id = pr.id
    WHERE umh.id = medical_history_entries.unified_medical_history_id 
    AND pr.user_id = auth.uid()
  )
);

-- Add foreign key constraints
ALTER TABLE public.unified_medical_histories 
ADD CONSTRAINT fk_unified_medical_histories_medical_order 
FOREIGN KEY (medical_order_id) REFERENCES public.medical_orders(id) ON DELETE CASCADE;

ALTER TABLE public.unified_medical_histories 
ADD CONSTRAINT fk_unified_medical_histories_patient 
FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.medical_history_entries 
ADD CONSTRAINT fk_medical_history_entries_unified_history 
FOREIGN KEY (unified_medical_history_id) REFERENCES public.unified_medical_histories(id) ON DELETE CASCADE;

ALTER TABLE public.medical_history_entries 
ADD CONSTRAINT fk_medical_history_entries_appointment 
FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;

-- Create triggers for timestamp updates
CREATE TRIGGER update_unified_medical_histories_updated_at
BEFORE UPDATE ON public.unified_medical_histories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medical_history_entries_updated_at
BEFORE UPDATE ON public.medical_history_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();