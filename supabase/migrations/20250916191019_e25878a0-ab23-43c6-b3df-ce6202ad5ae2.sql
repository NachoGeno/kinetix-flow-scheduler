-- Fix validate_appointment_date trigger to allow status updates on older appointments
-- Only validate date when it's actually being changed during UPDATE operations

CREATE OR REPLACE FUNCTION public.validate_appointment_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- For INSERT operations, always validate the date
  IF TG_OP = 'INSERT' THEN
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
  END IF;

  -- For UPDATE operations, only validate if appointment_date is actually changing
  IF TG_OP = 'UPDATE' AND OLD.appointment_date IS DISTINCT FROM NEW.appointment_date THEN
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
  END IF;

  RETURN NEW;
END;
$function$;