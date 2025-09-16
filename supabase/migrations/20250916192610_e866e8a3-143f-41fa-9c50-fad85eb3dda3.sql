-- Fix the handle_appointment_completion trigger function
-- Remove the problematic loop that tries to iterate over a void function result

CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Solo procesar cuando se cambia a 'completed' o 'in_progress'
    IF NEW.status IN ('completed', 'in_progress') AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'in_progress')) THEN
        
        -- Recalcular las sesiones del paciente
        PERFORM public.recalc_patient_order_sessions_with_assignments(NEW.patient_id);
        
        RAISE NOTICE 'Sesiones recalculadas para paciente % después de completar cita %', NEW.patient_id, NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;