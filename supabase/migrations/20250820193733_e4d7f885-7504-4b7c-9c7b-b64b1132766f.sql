-- Crear tabla para documentos de presentaciones
CREATE TABLE public.presentation_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medical_order_id UUID NOT NULL REFERENCES public.medical_orders(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('medical_order', 'clinical_evolution', 'attendance_record')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.presentation_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all presentation documents" 
ON public.presentation_documents 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Doctors can manage presentation documents" 
ON public.presentation_documents 
FOR ALL 
USING (get_user_role(auth.uid()) = 'doctor'::user_role);

-- Trigger for updated_at
CREATE TRIGGER update_presentation_documents_updated_at
BEFORE UPDATE ON public.presentation_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_presentation_documents_medical_order_id ON public.presentation_documents(medical_order_id);
CREATE INDEX idx_presentation_documents_document_type ON public.presentation_documents(document_type);

-- Add a status column to track presentation completeness
ALTER TABLE public.medical_orders 
ADD COLUMN presentation_status TEXT DEFAULT 'pending' CHECK (presentation_status IN ('pending', 'incomplete', 'complete', 'submitted'));

-- Create a function to check if all appointments for a medical order are completed
CREATE OR REPLACE FUNCTION public.check_presentation_ready(order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_sessions INTEGER;
    completed_sessions INTEGER;
    order_sessions_used INTEGER;
BEGIN
    -- Get order details
    SELECT total_sessions, sessions_used 
    INTO total_sessions, order_sessions_used
    FROM medical_orders 
    WHERE id = order_id;
    
    -- If order doesn't exist, return false
    IF total_sessions IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get patient from the order
    SELECT COUNT(*) INTO completed_sessions
    FROM appointments a
    JOIN medical_orders mo ON mo.patient_id = a.patient_id
    WHERE mo.id = order_id
    AND a.status IN ('completed', 'in_progress');
    
    -- Check if all required sessions are completed
    -- Either by sessions_used count or by completed appointments
    RETURN (order_sessions_used >= total_sessions) OR (completed_sessions >= total_sessions);
END;
$$;