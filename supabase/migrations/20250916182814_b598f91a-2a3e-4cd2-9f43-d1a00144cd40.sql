-- Fix auto_generate_final_summary function to include organization_id
CREATE OR REPLACE FUNCTION public.auto_generate_final_summary()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_medical_order_id UUID;
    v_total_sessions INTEGER;
    v_completed_sessions INTEGER;
    v_unified_history_id UUID;
    v_final_summary JSONB;
BEGIN
    -- Solo procesar si el appointment se está marcando como completado
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Buscar la orden médica asociada al paciente (activa más reciente)
        SELECT mo.id, mo.total_sessions 
        INTO v_medical_order_id, v_total_sessions
        FROM medical_orders mo
        WHERE mo.patient_id = NEW.patient_id
        AND mo.completed = false
        ORDER BY mo.created_at DESC
        LIMIT 1;
        
        IF v_medical_order_id IS NOT NULL THEN
            -- CORREGIDO: Contar solo sesiones completadas DESPUÉS de la creación de esta orden médica específica
            -- y que no estén ya contabilizadas en otras órdenes médicas completadas
            WITH order_creation_date AS (
                SELECT created_at::date as order_date 
                FROM medical_orders 
                WHERE id = v_medical_order_id
            ),
            other_completed_orders AS (
                SELECT mo.id, mo.created_at::date as order_date, mo.sessions_used
                FROM medical_orders mo
                WHERE mo.patient_id = NEW.patient_id 
                AND mo.completed = true 
                AND mo.id != v_medical_order_id
                ORDER BY mo.created_at
            )
            SELECT COUNT(*)
            INTO v_completed_sessions
            FROM appointments a
            CROSS JOIN order_creation_date ocd
            WHERE a.patient_id = NEW.patient_id
            AND a.status = 'completed'
            AND a.appointment_date >= ocd.order_date
            -- Excluir sesiones ya contabilizadas en órdenes médicas completadas anteriores
            AND NOT EXISTS (
                SELECT 1 FROM other_completed_orders oco
                WHERE a.appointment_date < ocd.order_date 
                AND a.appointment_date >= oco.order_date
            );
            
            -- Si se completaron todas las sesiones requeridas
            IF v_completed_sessions >= v_total_sessions THEN
                
                -- Obtener o crear unified_medical_history
                SELECT id INTO v_unified_history_id
                FROM unified_medical_histories
                WHERE medical_order_id = v_medical_order_id;
                
                IF v_unified_history_id IS NULL THEN
                    INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data, organization_id)
                    VALUES (v_medical_order_id, NEW.patient_id, '{}', NEW.organization_id)
                    RETURNING id INTO v_unified_history_id;
                END IF;
                
                -- Generar el resumen final automáticamente
                v_final_summary := jsonb_build_object(
                    'final_summary', jsonb_build_object(
                        'total_sessions_completed', v_completed_sessions,
                        'completion_date', NOW(),
                        'summary', 'Tratamiento completado según orden médica. Todas las sesiones han sido realizadas.',
                        'recommendations', 'Seguimiento según indicación médica.',
                        'generated_automatically', true
                    )
                );
                
                -- Actualizar la unified_medical_history con el resumen final
                UPDATE unified_medical_histories
                SET template_data = COALESCE(template_data, '{}'::jsonb) || v_final_summary,
                    updated_at = NOW()
                WHERE id = v_unified_history_id;
                
                -- Marcar la orden médica como completada
                UPDATE medical_orders
                SET completed = true,
                    completed_at = NOW(),
                    sessions_used = v_completed_sessions
                WHERE id = v_medical_order_id;
                
                RAISE NOTICE 'Resumen final generado automáticamente para orden médica %', v_medical_order_id;
            ELSE
                -- Solo actualizar el contador de sesiones usadas sin completar la orden
                UPDATE medical_orders
                SET sessions_used = v_completed_sessions,
                    updated_at = NOW()
                WHERE id = v_medical_order_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Fix auto_generate_final_summary_on_order_completion function to include organization_id
CREATE OR REPLACE FUNCTION public.auto_generate_final_summary_on_order_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_unified_history_id UUID;
    v_final_summary JSONB;
    v_completed_sessions INTEGER;
BEGIN
    -- Solo procesar si la orden médica se está marcando como completada
    IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
        
        -- Contar sesiones completadas para este paciente
        SELECT COUNT(*)
        INTO v_completed_sessions
        FROM appointments a
        WHERE a.patient_id = NEW.patient_id
        AND a.status = 'completed';
        
        -- Si no hay sesiones completadas pero la orden se marca como completada manualmente,
        -- usar sessions_used de la orden médica
        IF v_completed_sessions = 0 AND NEW.sessions_used > 0 THEN
            v_completed_sessions := NEW.sessions_used;
        END IF;
        
        -- Obtener o crear unified_medical_history
        SELECT id INTO v_unified_history_id
        FROM unified_medical_histories
        WHERE medical_order_id = NEW.id;
        
        IF v_unified_history_id IS NULL THEN
            INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data, organization_id)
            VALUES (NEW.id, NEW.patient_id, '{}', NEW.organization_id)
            RETURNING id INTO v_unified_history_id;
        END IF;
        
        -- Generar el resumen final automáticamente
        v_final_summary := jsonb_build_object(
            'final_summary', jsonb_build_object(
                'total_sessions_completed', v_completed_sessions,
                'completion_date', NOW(),
                'summary', 'Tratamiento completado según orden médica. Todas las sesiones han sido realizadas.',
                'recommendations', 'Seguimiento según indicación médica.',
                'generated_automatically', true,
                'completed_manually', true
            )
        );
        
        -- Actualizar la unified_medical_history con el resumen final
        UPDATE unified_medical_histories
        SET template_data = COALESCE(template_data, '{}'::jsonb) || v_final_summary,
            updated_at = NOW()
        WHERE id = v_unified_history_id;
        
        RAISE NOTICE 'Resumen final generado automáticamente para orden médica completada manualmente %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Fix generate_final_summary_for_completed_order function to include organization_id
CREATE OR REPLACE FUNCTION public.generate_final_summary_for_completed_order(order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_medical_order medical_orders%ROWTYPE;
    v_unified_history_id UUID;
    v_final_summary JSONB;
BEGIN
    -- Obtener la orden médica
    SELECT * INTO v_medical_order
    FROM medical_orders
    WHERE id = order_id AND completed = true;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Orden médica % no encontrada o no completada', order_id;
        RETURN FALSE;
    END IF;
    
    -- Verificar si ya existe una historia unificada
    SELECT id INTO v_unified_history_id
    FROM unified_medical_histories
    WHERE medical_order_id = order_id;
    
    -- Si no existe, crearla
    IF v_unified_history_id IS NULL THEN
        INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data, organization_id)
        VALUES (order_id, v_medical_order.patient_id, '{}', v_medical_order.organization_id)
        RETURNING id INTO v_unified_history_id;
        
        RAISE NOTICE 'Historia unificada creada para orden %', order_id;
    END IF;
    
    -- Verificar si ya tiene resumen final
    SELECT template_data->'final_summary' INTO v_final_summary
    FROM unified_medical_histories
    WHERE id = v_unified_history_id;
    
    -- Si no tiene resumen final, generarlo
    IF v_final_summary IS NULL OR v_final_summary = 'null'::jsonb THEN
        v_final_summary := jsonb_build_object(
            'final_summary', jsonb_build_object(
                'total_sessions_completed', v_medical_order.sessions_used,
                'completion_date', COALESCE(v_medical_order.completed_at, NOW()),
                'summary', 'Tratamiento completado según orden médica. Todas las sesiones han sido realizadas.',
                'recommendations', 'Seguimiento según indicación médica.',
                'generated_automatically', true,
                'generated_manually', true
            )
        );
        
        -- Actualizar la historia unificada
        UPDATE unified_medical_histories
        SET template_data = COALESCE(template_data, '{}'::jsonb) || v_final_summary,
            updated_at = NOW()
        WHERE id = v_unified_history_id;
        
        RAISE NOTICE 'Resumen final generado para orden % con % sesiones', order_id, v_medical_order.sessions_used;
        RETURN TRUE;
    ELSE
        RAISE NOTICE 'La orden % ya tiene resumen final', order_id;
        RETURN TRUE;
    END IF;
END;
$function$;

-- Add safety trigger to unified_medical_histories to auto-set organization_id if NULL
CREATE OR REPLACE FUNCTION public.set_unified_medical_history_organization_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Si organization_id no está seteado, obtenerlo de la orden médica
    IF NEW.organization_id IS NULL THEN
        SELECT organization_id INTO NEW.organization_id
        FROM public.medical_orders 
        WHERE id = NEW.medical_order_id;
        
        -- Si aún no se encontró, usar el del usuario actual como fallback
        IF NEW.organization_id IS NULL THEN
            SELECT organization_id INTO NEW.organization_id
            FROM public.profiles 
            WHERE user_id = auth.uid();
        END IF;
        
        -- Si todavía no se encontró, usar Rehabilitare1 por defecto
        IF NEW.organization_id IS NULL THEN
            NEW.organization_id := 'a0000000-0000-0000-0000-000000000001';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS set_unified_medical_history_organization_id_trigger ON public.unified_medical_histories;
CREATE TRIGGER set_unified_medical_history_organization_id_trigger
    BEFORE INSERT ON public.unified_medical_histories
    FOR EACH ROW
    EXECUTE FUNCTION public.set_unified_medical_history_organization_id();