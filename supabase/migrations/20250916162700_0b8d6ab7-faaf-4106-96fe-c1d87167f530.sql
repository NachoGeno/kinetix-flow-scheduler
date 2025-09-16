-- ============================================================================
-- TRIGGERS PARA AUTOMATIZACIÓN DEL SISTEMA DE SESIONES
-- ============================================================================

-- 1. Trigger para auto-asignación FIFO en nuevas citas
CREATE OR REPLACE FUNCTION public.handle_new_appointment_auto_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Solo procesar citas programadas/confirmadas que no sean reprogramaciones
    IF NEW.status IN ('scheduled', 'confirmed') AND NEW.rescheduled_from_id IS NULL THEN
        -- Intentar asignación automática si no hay asignación explícita
        PERFORM assign_appointment_to_oldest_available_order(NEW.patient_id, NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger para auto-asignación
DROP TRIGGER IF EXISTS trigger_auto_assign_appointment ON appointments;
CREATE TRIGGER trigger_auto_assign_appointment
    AFTER INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_appointment_auto_assignment();

-- 2. Trigger para validar capacidad antes de asignar
CREATE OR REPLACE FUNCTION public.validate_order_capacity_before_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    order_record RECORD;
    current_sessions INTEGER;
BEGIN
    -- Obtener información de la orden
    SELECT mo.total_sessions, mo.sessions_used, mo.completed
    INTO order_record
    FROM medical_orders mo
    WHERE mo.id = NEW.medical_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden médica % no encontrada', NEW.medical_order_id;
    END IF;
    
    -- Si la orden ya está completada, rechazar
    IF order_record.completed THEN
        RAISE EXCEPTION 'No se puede asignar a orden médica completada';
    END IF;
    
    -- Contar sesiones actualmente asignadas
    SELECT COUNT(*)
    INTO current_sessions
    FROM appointment_order_assignments aoa
    JOIN appointments a ON aoa.appointment_id = a.id
    WHERE aoa.medical_order_id = NEW.medical_order_id
    AND a.status IN ('scheduled', 'confirmed', 'completed', 'in_progress');
    
    -- Validar capacidad
    IF current_sessions >= order_record.total_sessions THEN
        RAISE EXCEPTION 'La orden médica ha alcanzado su capacidad máxima (% de % sesiones)', 
                       current_sessions, order_record.total_sessions;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger para validación de capacidad
DROP TRIGGER IF EXISTS trigger_validate_order_capacity ON appointment_order_assignments;
CREATE TRIGGER trigger_validate_order_capacity
    BEFORE INSERT ON appointment_order_assignments
    FOR EACH ROW
    EXECUTE FUNCTION validate_order_capacity_before_assignment();

-- 3. Trigger para recalcular sesiones después de cambios en asignaciones
CREATE OR REPLACE FUNCTION public.handle_assignment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    order_id_to_recalc UUID;
BEGIN
    -- Determinar qué orden recalcular según la operación
    IF TG_OP = 'INSERT' THEN
        order_id_to_recalc := NEW.medical_order_id;
    ELSIF TG_OP = 'DELETE' THEN
        order_id_to_recalc := OLD.medical_order_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Recalcular ambas órdenes si cambió la asignación
        PERFORM recalc_order_sessions(OLD.medical_order_id);
        order_id_to_recalc := NEW.medical_order_id;
    END IF;
    
    -- Recalcular la orden afectada
    PERFORM recalc_order_sessions(order_id_to_recalc);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Crear trigger para recalcular después de cambios en asignaciones
DROP TRIGGER IF EXISTS trigger_recalc_on_assignment_change ON appointment_order_assignments;
CREATE TRIGGER trigger_recalc_on_assignment_change
    AFTER INSERT OR UPDATE OR DELETE ON appointment_order_assignments
    FOR EACH ROW
    EXECUTE FUNCTION handle_assignment_changes();

-- 4. Trigger para recalcular cuando cambie el status de cita
CREATE OR REPLACE FUNCTION public.handle_appointment_status_change_for_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    assigned_order_id UUID;
BEGIN
    -- Solo procesar si cambió el status
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Buscar si esta cita está asignada a alguna orden
        SELECT medical_order_id INTO assigned_order_id
        FROM appointment_order_assignments
        WHERE appointment_id = NEW.id;
        
        -- Si está asignada, recalcular la orden
        IF FOUND THEN
            PERFORM recalc_order_sessions(assigned_order_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Crear trigger para recalcular cuando cambie status de cita
DROP TRIGGER IF EXISTS trigger_recalc_on_status_change ON appointments;
CREATE TRIGGER trigger_recalc_on_status_change
    AFTER UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION handle_appointment_status_change_for_orders();

-- ============================================================================
-- CORRECCIÓN DE DATOS EXISTENTES
-- ============================================================================

-- Recalcular todas las órdenes existentes con el nuevo sistema
DO $$
DECLARE
    patient_record RECORD;
    total_patients INTEGER := 0;
    processed_count INTEGER := 0;
BEGIN
    -- Contar total de pacientes para progreso
    SELECT COUNT(DISTINCT patient_id) INTO total_patients 
    FROM medical_orders;
    
    RAISE NOTICE 'Iniciando recálculo para % pacientes...', total_patients;
    
    -- Recalcular por cada paciente que tenga órdenes médicas
    FOR patient_record IN 
        SELECT DISTINCT patient_id 
        FROM medical_orders 
        ORDER BY patient_id
    LOOP
        processed_count := processed_count + 1;
        PERFORM recalc_patient_order_sessions_with_assignments(patient_record.patient_id);
        
        -- Mostrar progreso cada 10 pacientes
        IF processed_count % 10 = 0 THEN
            RAISE NOTICE 'Procesados % de % pacientes...', processed_count, total_patients;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Recálculo completado para % pacientes', processed_count;
END $$;