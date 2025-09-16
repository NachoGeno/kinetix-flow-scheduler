-- ============================================================================
-- SOLUCIÓN COMPLETA PARA SISTEMA DE DESCUENTO DE SESIONES - CORREGIDA
-- ============================================================================

-- Primero eliminar función existente que conflictúa
DROP FUNCTION IF EXISTS public.recalc_patient_order_sessions_with_assignments(UUID);

-- 1. Función para recalcular sesiones de una orden específica
-- Cuenta sesiones asignadas activas (scheduled, confirmed, completed, in_progress)
-- Excluye cancelled y rescheduled
CREATE OR REPLACE FUNCTION public.recalc_order_sessions(order_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    active_sessions_count INTEGER;
BEGIN
    -- Contar sesiones asignadas activas para esta orden
    SELECT COUNT(*)
    INTO active_sessions_count
    FROM appointment_order_assignments aoa
    JOIN appointments a ON aoa.appointment_id = a.id
    WHERE aoa.medical_order_id = order_id_param
    AND a.status IN ('scheduled', 'confirmed', 'completed', 'in_progress');
    
    -- Actualizar sessions_used en la orden médica
    UPDATE medical_orders
    SET 
        sessions_used = active_sessions_count,
        completed = (active_sessions_count >= total_sessions),
        completed_at = CASE 
            WHEN (active_sessions_count >= total_sessions) AND completed = false 
            THEN NOW() 
            ELSE completed_at 
        END,
        updated_at = NOW()
    WHERE id = order_id_param;
    
    RAISE NOTICE 'Orden % recalculada: % sesiones activas', order_id_param, active_sessions_count;
END;
$$;

-- 2. Función para asignar automáticamente a la orden más antigua disponible (FIFO)
CREATE OR REPLACE FUNCTION public.assign_appointment_to_oldest_available_order(
    patient_id_param UUID, 
    appointment_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_order_id UUID;
    order_record RECORD;
BEGIN
    -- Buscar la orden médica más antigua que tenga cupo disponible
    SELECT mo.id, mo.total_sessions, mo.sessions_used
    INTO order_record
    FROM medical_orders mo
    WHERE mo.patient_id = patient_id_param
    AND mo.completed = false
    AND mo.sessions_used < mo.total_sessions
    ORDER BY mo.created_at ASC
    LIMIT 1;
    
    -- Si no se encontró orden disponible, no asignar
    IF NOT FOUND THEN
        RAISE NOTICE 'No hay órdenes disponibles para el paciente %', patient_id_param;
        RETURN FALSE;
    END IF;
    
    target_order_id := order_record.id;
    
    -- Crear la asignación
    INSERT INTO appointment_order_assignments (
        appointment_id,
        medical_order_id,
        assigned_by
    )
    VALUES (
        appointment_id_param,
        target_order_id,
        get_current_user_profile_id()
    );
    
    RAISE NOTICE 'Cita % asignada automáticamente a orden % (FIFO)', appointment_id_param, target_order_id;
    RETURN TRUE;
    
EXCEPTION
    WHEN unique_violation THEN
        -- La cita ya está asignada
        RAISE NOTICE 'Cita % ya está asignada', appointment_id_param;
        RETURN FALSE;
    WHEN OTHERS THEN
        RAISE WARNING 'Error asignando cita %: %', appointment_id_param, SQLERRM;
        RETURN FALSE;
END;
$$;

-- 3. Recrear función para usar sesiones activas en lugar de completadas
CREATE OR REPLACE FUNCTION public.recalc_patient_order_sessions_with_assignments(patient_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    order_record RECORD;
BEGIN
    -- Recalcular todas las órdenes del paciente
    FOR order_record IN 
        SELECT id FROM medical_orders 
        WHERE patient_id = patient_uuid
        ORDER BY created_at ASC
    LOOP
        PERFORM recalc_order_sessions(order_record.id);
    END LOOP;
    
    RAISE NOTICE 'Recalculadas todas las órdenes para paciente %', patient_uuid;
END;
$$;

-- ============================================================================
-- TRIGGERS PARA AUTOMATIZACIÓN
-- ============================================================================

-- 4. Trigger para auto-asignación FIFO en nuevas citas
CREATE OR REPLACE FUNCTION public.handle_new_appointment_auto_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Solo procesar citas programadas/confirmadas que no sean reprogramaciones
    IF NEW.status IN ('scheduled', 'confirmed') AND NEW.rescheduled_from_id IS NULL THEN
        -- Intentar asignación automática si no hay asignación explícita
        -- (se ejecuta después del INSERT, si no se asigna explícitamente se hará aquí)
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

-- 5. Trigger para validar capacidad antes de asignar
CREATE OR REPLACE FUNCTION public.validate_order_capacity_before_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 6. Trigger para recalcular sesiones después de cambios en asignaciones
CREATE OR REPLACE FUNCTION public.handle_assignment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 7. Trigger para recalcular cuando cambie el status de cita
CREATE OR REPLACE FUNCTION public.handle_appointment_status_change_for_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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