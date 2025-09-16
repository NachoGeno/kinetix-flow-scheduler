-- Primero eliminar la función existente que tiene tipo de retorno diferente
DROP FUNCTION IF EXISTS public.recalc_patient_order_sessions_with_assignments(uuid);

-- ============================================================================
-- SOLUCIÓN COMPLETA PARA SISTEMA DE DESCUENTO DE SESIONES
-- ============================================================================

-- 1. Función para recalcular sesiones de una orden específica
CREATE OR REPLACE FUNCTION public.recalc_order_sessions(order_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    active_sessions_count INTEGER;
BEGIN
    -- Contar sesiones asignadas activas (scheduled, confirmed, completed, in_progress)
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

-- 3. Recrear función para recalcular órdenes de un paciente
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