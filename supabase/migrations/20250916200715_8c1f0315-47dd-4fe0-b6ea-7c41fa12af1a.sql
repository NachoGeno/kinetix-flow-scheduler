-- Fix security issues by setting search_path on all functions

CREATE OR REPLACE FUNCTION public.handle_appointment_order_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- When an assignment is created, recalculate the order sessions
    IF TG_OP = 'INSERT' THEN
        PERFORM recalc_order_sessions(NEW.medical_order_id);
        RETURN NEW;
    END IF;
    
    -- When an assignment is deleted, recalculate the order sessions
    IF TG_OP = 'DELETE' THEN
        PERFORM recalc_order_sessions(OLD.medical_order_id);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_appointment_status_change_for_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    order_id UUID;
BEGIN
    -- Only process if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Get all medical orders associated with this appointment
        FOR order_id IN 
            SELECT aoa.medical_order_id 
            FROM appointment_order_assignments aoa 
            WHERE aoa.appointment_id = NEW.id
        LOOP
            -- Recalculate sessions for each associated order
            PERFORM recalc_order_sessions(order_id);
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_appointment_to_oldest_available_order(patient_id_param uuid, appointment_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    target_order_id UUID;
    order_record RECORD;
    current_assigned_sessions INTEGER;
BEGIN
    -- Check if appointment is already assigned
    IF EXISTS (
        SELECT 1 FROM appointment_order_assignments 
        WHERE appointment_id = appointment_id_param
    ) THEN
        RAISE NOTICE 'Cita % ya está asignada', appointment_id_param;
        RETURN FALSE;
    END IF;
    
    -- Find the oldest order with available capacity
    FOR order_record IN 
        SELECT 
            mo.id, 
            mo.total_sessions,
            mo.sessions_used,
            COUNT(aoa.appointment_id) as current_assignments
        FROM medical_orders mo
        LEFT JOIN appointment_order_assignments aoa ON aoa.medical_order_id = mo.id
        LEFT JOIN appointments a ON a.id = aoa.appointment_id
        WHERE mo.patient_id = patient_id_param
        AND mo.completed = false
        GROUP BY mo.id, mo.total_sessions, mo.sessions_used
        HAVING COUNT(CASE WHEN a.status NOT IN ('cancelled', 'no_show') OR a.status IS NULL THEN aoa.appointment_id END) < mo.total_sessions
        ORDER BY mo.created_at ASC
        LIMIT 1
    LOOP
        target_order_id := order_record.id;
        
        -- Create the assignment
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
        
        RAISE NOTICE 'Cita % asignada a orden % (FIFO)', appointment_id_param, target_order_id;
        RETURN TRUE;
    END LOOP;
    
    RAISE NOTICE 'No hay órdenes disponibles para el paciente %', patient_id_param;
    RETURN FALSE;
    
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Cita % ya está asignada', appointment_id_param;
        RETURN FALSE;
    WHEN OTHERS THEN
        RAISE WARNING 'Error asignando cita %: %', appointment_id_param, SQLERRM;
        RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_appointment_auto_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Only process scheduled/confirmed appointments that are not rescheduled
    IF NEW.status IN ('scheduled', 'confirmed') AND NEW.rescheduled_from_id IS NULL THEN
        -- Try auto-assignment (will be handled by the trigger after INSERT)
        PERFORM assign_appointment_to_oldest_available_order(NEW.patient_id, NEW.id);
    END IF;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_order_over_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    current_assignments INTEGER;
    total_sessions INTEGER;
BEGIN
    -- Count current assignments for this order (excluding cancelled appointments)
    SELECT COUNT(*), mo.total_sessions
    INTO current_assignments, total_sessions
    FROM appointment_order_assignments aoa
    JOIN appointments a ON a.id = aoa.appointment_id
    JOIN medical_orders mo ON mo.id = aoa.medical_order_id
    WHERE aoa.medical_order_id = NEW.medical_order_id
    AND a.status NOT IN ('cancelled', 'no_show')
    GROUP BY mo.total_sessions;
    
    -- If this would exceed the total sessions, prevent the assignment
    IF current_assignments >= total_sessions THEN
        RAISE EXCEPTION 'No se puede asignar más citas a esta orden médica. Sesiones totales: %, ya asignadas: %', 
            total_sessions, current_assignments;
    END IF;
    
    RETURN NEW;
END;
$function$;