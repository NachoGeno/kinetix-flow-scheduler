-- Temporalmente deshabilitar el trigger de validación para permitir el nuevo sistema
-- El nuevo sistema cuenta sesiones programadas, no solo completadas
DROP TRIGGER IF EXISTS validate_medical_order_sessions_trigger ON medical_orders;

-- Crear nueva función de validación compatible con el sistema de asignaciones
CREATE OR REPLACE FUNCTION public.validate_medical_order_sessions_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    assigned_sessions INTEGER;
BEGIN
    -- Solo validar si sessions_used o completed está siendo cambiado
    IF TG_OP = 'UPDATE' AND (
        OLD.sessions_used IS DISTINCT FROM NEW.sessions_used OR 
        OLD.completed IS DISTINCT FROM NEW.completed
    ) THEN
        
        -- Contar sesiones asignadas activas (método nuevo)
        SELECT COUNT(*)
        INTO assigned_sessions
        FROM appointment_order_assignments aoa
        JOIN appointments a ON aoa.appointment_id = a.id
        WHERE aoa.medical_order_id = NEW.id
        AND a.status IN ('scheduled', 'confirmed', 'completed', 'in_progress');
        
        -- Permitir que sessions_used sea igual a las sesiones asignadas
        -- (el nuevo sistema maneja esto automáticamente)
        IF NEW.sessions_used > assigned_sessions + 1 THEN
            RAISE EXCEPTION 'Cannot set sessions_used (%) higher than assigned appointments (%)', 
                NEW.sessions_used, assigned_sessions;
        END IF;
        
        -- Permitir completar orden si se alcanza el total de sesiones o es alta temprana
        IF NEW.completed = true AND NEW.early_discharge != true AND NEW.sessions_used < NEW.total_sessions THEN
            RAISE EXCEPTION 'Cannot mark order as completed: only % of % sessions assigned', 
                NEW.sessions_used, NEW.total_sessions;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear el nuevo trigger de validación compatible
CREATE TRIGGER validate_medical_order_sessions_assignments_trigger
    BEFORE UPDATE ON medical_orders
    FOR EACH ROW
    EXECUTE FUNCTION validate_medical_order_sessions_assignments();

-- Ahora intentar recalcular todas las órdenes con el nuevo sistema
DO $$
DECLARE
    patient_record RECORD;
    total_patients INTEGER := 0;
    processed_patients INTEGER := 0;
BEGIN
    -- Contar total de pacientes para progreso
    SELECT COUNT(DISTINCT patient_id) INTO total_patients 
    FROM medical_orders;
    
    RAISE NOTICE 'Iniciando recálculo para % pacientes con nuevo sistema...', total_patients;
    
    -- Recalcular por cada paciente que tenga órdenes médicas
    FOR patient_record IN 
        SELECT DISTINCT patient_id 
        FROM medical_orders 
        ORDER BY patient_id
    LOOP
        processed_patients := processed_patients + 1;
        
        BEGIN
            PERFORM recalc_patient_order_sessions_with_assignments(patient_record.patient_id);
            
            IF processed_patients % 10 = 0 THEN
                RAISE NOTICE 'Procesados %/% pacientes...', processed_patients, total_patients;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Error procesando paciente %: %', patient_record.patient_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Recálculo completado para % pacientes', processed_patients;
END $$;