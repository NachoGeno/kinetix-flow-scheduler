-- Fix remaining database functions that need proper search_path security settings

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
    INSERT INTO public.profiles (user_id, first_name, last_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuario'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nuevo'),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'patient')
    );
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_progress_notes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_medical_order_patient()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Si se está intentando cambiar el patient_id de una orden existente
  IF TG_OP = 'UPDATE' AND OLD.patient_id != NEW.patient_id THEN
    RAISE EXCEPTION 'Esta orden médica está asignada a otro paciente y no puede reasignarse.';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_patient_appointments_on_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Solo proceder si el paciente está siendo desactivado (eliminado)
  IF OLD.is_active = true AND NEW.is_active = false THEN
    
    -- Verificar si el paciente tiene citas completadas (ha asistido a sesiones)
    IF EXISTS (
      SELECT 1 
      FROM public.appointments 
      WHERE patient_id = NEW.id 
      AND status = 'completed'
    ) THEN
      -- Si tiene citas completadas, no cancelar ningún turno
      -- Solo registrar en logs si fuera necesario
      RAISE NOTICE 'Paciente % tiene sesiones completadas, no se cancelan turnos', NEW.id;
    ELSE
      -- Si no tiene citas completadas, cancelar todos los turnos programados
      UPDATE public.appointments 
      SET status = 'cancelled'
      WHERE patient_id = NEW.id 
      AND status IN ('scheduled', 'confirmed', 'in_progress');
      
      RAISE NOTICE 'Turnos cancelados para paciente % sin sesiones completadas', NEW.id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_final_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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
        
        -- Buscar la orden médica asociada al paciente
        SELECT mo.id, mo.total_sessions 
        INTO v_medical_order_id, v_total_sessions
        FROM medical_orders mo
        WHERE mo.patient_id = NEW.patient_id
        AND mo.completed = false
        ORDER BY mo.created_at DESC
        LIMIT 1;
        
        IF v_medical_order_id IS NOT NULL THEN
            -- Contar sesiones completadas para esta orden médica
            SELECT COUNT(*)
            INTO v_completed_sessions
            FROM appointments a
            WHERE a.patient_id = NEW.patient_id
            AND a.status = 'completed';
            
            -- Si se completaron todas las sesiones requeridas
            IF v_completed_sessions >= v_total_sessions THEN
                
                -- Obtener o crear unified_medical_history
                SELECT id INTO v_unified_history_id
                FROM unified_medical_histories
                WHERE medical_order_id = v_medical_order_id;
                
                IF v_unified_history_id IS NULL THEN
                    INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data)
                    VALUES (v_medical_order_id, NEW.patient_id, '{}')
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
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_final_summary_on_order_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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
            INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data)
            VALUES (NEW.id, NEW.patient_id, '{}')
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

CREATE OR REPLACE FUNCTION public.generate_final_summary_for_completed_order(order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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
        INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data)
        VALUES (order_id, v_medical_order.patient_id, '{}')
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