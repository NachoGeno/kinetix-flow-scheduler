-- Add rescheduling functionality to appointments table
ALTER TABLE public.appointments 
ADD COLUMN rescheduled_from_id UUID REFERENCES public.appointments(id),
ADD COLUMN rescheduled_to_id UUID REFERENCES public.appointments(id),
ADD COLUMN rescheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN rescheduled_by UUID,
ADD COLUMN reschedule_reason TEXT;

-- Add new status for rescheduled appointments
ALTER TYPE appointment_status ADD VALUE 'rescheduled';

-- Create index for better performance
CREATE INDEX idx_appointments_rescheduled_from ON public.appointments(rescheduled_from_id);
CREATE INDEX idx_appointments_rescheduled_to ON public.appointments(rescheduled_to_id);

-- Update the existing trigger to handle rescheduling logic
CREATE OR REPLACE FUNCTION public.handle_appointment_reschedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- If this is a new appointment being created as a reschedule
    IF NEW.rescheduled_from_id IS NOT NULL AND OLD IS NULL THEN
        -- Update the original appointment to mark it as rescheduled
        UPDATE public.appointments 
        SET status = 'rescheduled',
            rescheduled_to_id = NEW.id,
            rescheduled_at = NEW.created_at,
            rescheduled_by = NEW.rescheduled_by
        WHERE id = NEW.rescheduled_from_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for appointment reschedule handling
DROP TRIGGER IF EXISTS trigger_handle_appointment_reschedule ON public.appointments;
CREATE TRIGGER trigger_handle_appointment_reschedule
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_appointment_reschedule();