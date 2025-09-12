-- Update the validation function to include both completed and no_show_session_lost appointments
-- as valid sessions for completing medical orders

CREATE OR REPLACE FUNCTION public.validate_medical_order_sessions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    real_completed_sessions INTEGER;
BEGIN
    -- Solo validar si sessions_used o completed está siendo cambiado
    IF TG_OP = 'UPDATE' AND (
        NEW.sessions_used != OLD.sessions_used OR 
        NEW.completed != OLD.completed
    ) THEN
        
        -- Permitir completar si es alta temprana
        IF NEW.early_discharge = true AND NEW.completed = true THEN
            RETURN NEW;
        END IF;
        
        -- Contar sesiones que cuentan para completar (incluye ausentes)
        SELECT COUNT(*)
        INTO real_completed_sessions
        FROM appointments a
        WHERE a.patient_id = NEW.patient_id
        AND a.status IN ('completed', 'no_show_session_lost');
        
        -- Prevenir sessions_used mayor a sesiones válidas reales
        -- a menos que sea actualización por trigger de appointment completion
        IF NEW.sessions_used > real_completed_sessions + 1 THEN
            RAISE EXCEPTION 'Cannot set sessions_used (%) higher than real valid appointments (%)', 
                NEW.sessions_used, real_completed_sessions;
        END IF;
        
        -- Prevenir marcar como completado si no hay suficientes sesiones válidas
        -- a menos que sea alta temprana
        IF NEW.completed = true AND NEW.early_discharge != true AND real_completed_sessions < NEW.total_sessions THEN
            RAISE EXCEPTION 'Cannot mark order as completed: only % of % sessions completed or attended', 
                real_completed_sessions, NEW.total_sessions;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$function$;