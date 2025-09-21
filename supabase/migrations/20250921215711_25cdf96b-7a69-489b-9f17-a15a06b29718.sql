-- Mejorar la función get_medical_orders_with_availability para ser más precisa
-- y garantizar que siempre devuelva órdenes válidas para asignación

CREATE OR REPLACE FUNCTION public.get_medical_orders_with_availability(patient_id_param uuid)
RETURNS TABLE(
    id uuid, 
    patient_id uuid, 
    doctor_id uuid, 
    order_type order_type, 
    description text, 
    instructions text, 
    total_sessions integer, 
    sessions_used integer, 
    active_assignments_count integer, 
    sessions_remaining integer, 
    completed boolean, 
    urgent boolean, 
    order_date date, 
    obra_social_art_id uuid, 
    organization_id uuid, 
    document_status text, 
    created_at timestamp with time zone, 
    updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT 
        mo.id,
        mo.patient_id,
        mo.doctor_id,
        mo.order_type,
        mo.description,
        mo.instructions,
        mo.total_sessions,
        mo.sessions_used,
        get_active_assignments_count(mo.id) as active_assignments_count,
        (mo.total_sessions - get_active_assignments_count(mo.id)) as sessions_remaining,
        mo.completed,
        mo.urgent,
        mo.order_date,
        mo.obra_social_art_id,
        mo.organization_id,
        mo.document_status,
        mo.created_at,
        mo.updated_at
    FROM medical_orders mo
    WHERE mo.patient_id = patient_id_param
    AND mo.organization_id = get_current_user_organization_id()
    -- VALIDACIONES ESTRICTAS:
    AND mo.completed = false  -- Solo órdenes NO completadas
    AND mo.total_sessions > get_active_assignments_count(mo.id)  -- Solo órdenes con sesiones disponibles
    AND mo.total_sessions > 0  -- Solo órdenes con sesiones válidas
    ORDER BY 
        mo.urgent DESC,  -- Urgentes primero
        mo.created_at DESC;  -- Más nuevas primero
$function$;

-- Crear función para validar capacidad de asignación antes de crear turnos
CREATE OR REPLACE FUNCTION public.validate_order_assignment_capacity(
    order_id_param uuid, 
    requested_sessions integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_order medical_orders%ROWTYPE;
    v_active_assignments integer;
    v_sessions_remaining integer;
    v_result jsonb;
BEGIN
    -- Obtener la orden médica
    SELECT * INTO v_order
    FROM medical_orders
    WHERE id = order_id_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'ORDEN_NO_ENCONTRADA',
            'message', 'La orden médica no existe'
        );
    END IF;
    
    -- Validar que no esté completada
    IF v_order.completed = true THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'ORDEN_COMPLETADA',
            'message', 'No se pueden asignar turnos a una orden ya completada'
        );
    END IF;
    
    -- Obtener asignaciones activas
    SELECT get_active_assignments_count(order_id_param) INTO v_active_assignments;
    v_sessions_remaining := v_order.total_sessions - v_active_assignments;
    
    -- Validar capacidad
    IF requested_sessions > v_sessions_remaining THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'CAPACIDAD_EXCEDIDA',
            'message', format('La orden solo tiene %s sesiones disponibles, se solicitaron %s', 
                            v_sessions_remaining, requested_sessions),
            'sessions_remaining', v_sessions_remaining,
            'sessions_requested', requested_sessions
        );
    END IF;
    
    -- Todo válido
    RETURN jsonb_build_object(
        'valid', true,
        'order_id', v_order.id,
        'total_sessions', v_order.total_sessions,
        'active_assignments', v_active_assignments,
        'sessions_remaining', v_sessions_remaining,
        'sessions_requested', requested_sessions
    );
END;
$function$;

-- Mejorar la función create_appointments_with_order con validaciones estrictas
CREATE OR REPLACE FUNCTION public.create_appointments_with_order(
    appointments_data jsonb, 
    medical_order_id_param uuid DEFAULT NULL::uuid, 
    assigned_by_param uuid DEFAULT NULL::uuid
)
RETURNS TABLE(appointment_id uuid, was_created boolean, conflict_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    appointment_record jsonb;
    created_appointment_id uuid;
    assignment_exists boolean;
    current_user_org_id uuid;
    total_appointments_count integer;
    validation_result jsonb;
BEGIN
    -- Get current user organization
    SELECT organization_id INTO current_user_org_id 
    FROM profiles 
    WHERE user_id = auth.uid();
    
    IF current_user_org_id IS NULL THEN
        RAISE EXCEPTION 'User organization not found';
    END IF;

    -- VALIDACIÓN CRÍTICA: Orden médica es OBLIGATORIA
    IF medical_order_id_param IS NULL THEN
        RAISE EXCEPTION 'ORDEN_REQUERIDA: Todos los turnos deben tener una orden médica asignada';
    END IF;

    -- Contar turnos a crear
    SELECT jsonb_array_length(appointments_data) INTO total_appointments_count;
    
    -- VALIDACIÓN ESTRICTA: Verificar capacidad de la orden
    SELECT validate_order_assignment_capacity(
        medical_order_id_param, 
        total_appointments_count
    ) INTO validation_result;
    
    IF NOT (validation_result->>'valid')::boolean THEN
        RAISE EXCEPTION 'VALIDACION_FALLIDA: %', validation_result->>'message';
    END IF;

    -- Log de auditoría
    RAISE NOTICE 'AUDIT_LOG: Creando % turnos para orden % por usuario %', 
                 total_appointments_count, medical_order_id_param, assigned_by_param;

    -- Procesar cada cita del array
    FOR appointment_record IN SELECT * FROM jsonb_array_elements(appointments_data)
    LOOP
        BEGIN
            -- Intentar crear la cita con ON CONFLICT DO NOTHING
            INSERT INTO appointments (
                patient_id,
                doctor_id, 
                appointment_date,
                appointment_time,
                reason,
                status,
                notes,
                organization_id,
                duration_minutes
            ) VALUES (
                (appointment_record->>'patient_id')::uuid,
                (appointment_record->>'doctor_id')::uuid,
                (appointment_record->>'appointment_date')::date,
                (appointment_record->>'appointment_time')::time,
                appointment_record->>'reason',
                COALESCE(appointment_record->>'status', 'scheduled')::appointment_status,
                appointment_record->>'notes',
                current_user_org_id,
                COALESCE((appointment_record->>'duration_minutes')::integer, 30)
            )
            ON CONFLICT ON CONSTRAINT idx_appointments_unique_active DO NOTHING
            RETURNING id INTO created_appointment_id;

            IF created_appointment_id IS NOT NULL THEN
                -- Cita creada exitosamente
                
                -- ASIGNACIÓN OBLIGATORIA a la orden médica
                INSERT INTO appointment_order_assignments (
                    appointment_id,
                    medical_order_id,
                    assigned_by
                ) VALUES (
                    created_appointment_id,
                    medical_order_id_param,
                    assigned_by_param
                );

                -- Log de auditoría detallado
                RAISE NOTICE 'AUDIT_LOG: Turno % creado y asignado a orden % exitosamente', 
                             created_appointment_id, medical_order_id_param;

                -- Devolver éxito
                RETURN QUERY SELECT created_appointment_id, true, NULL::text;
            ELSE
                -- La cita ya existía (conflicto con el índice único)
                RETURN QUERY SELECT NULL::uuid, false, 'Cita duplicada detectada y omitida'::text;
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                -- Error inesperado - Log detallado
                RAISE NOTICE 'AUDIT_LOG: ERROR creando turno: %', SQLERRM;
                RETURN QUERY SELECT NULL::uuid, false, ('Error: ' || SQLERRM)::text;
        END;
    END LOOP;
END;
$function$;