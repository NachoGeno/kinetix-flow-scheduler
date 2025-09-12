-- Secure the backup table with RLS and tighten function security

-- 1) Enable RLS on backup table and restrict access
ALTER TABLE IF EXISTS public.appointments_backup ENABLE ROW LEVEL SECURITY;

-- Allow only super admins to read backups
DROP POLICY IF EXISTS "Super admins can read appointments_backup" ON public.appointments_backup;
CREATE POLICY "Super admins can read appointments_backup"
ON public.appointments_backup
FOR SELECT
USING (is_super_admin(auth.uid()));

-- No insert/update/delete policies => denied by default under RLS

-- 2) Recreate validate_appointment_date with explicit search_path for security
DROP FUNCTION IF EXISTS public.validate_appointment_date();
CREATE OR REPLACE FUNCTION public.validate_appointment_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Guardrail: reject obviously wrong dates (over 1 year away)
  IF ABS(NEW.appointment_date - CURRENT_DATE) > 365 THEN
    RAISE EXCEPTION 'Fecha de cita inválida: % está muy lejos de la fecha actual', NEW.appointment_date;
  END IF;

  -- Auto-correct suspicious 10-day shift during business hours
  IF NEW.appointment_date::date - CURRENT_DATE = 10 AND 
     CURRENT_TIME BETWEEN '08:00'::time AND '22:00'::time THEN
    NEW.appointment_date = CURRENT_DATE;
    NEW.notes = COALESCE(NEW.notes || ' ', '') || '[FECHA AUTO-CORREGIDA]';
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trigger_validate_appointment_date ON public.appointments;
CREATE TRIGGER trigger_validate_appointment_date
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_appointment_date();