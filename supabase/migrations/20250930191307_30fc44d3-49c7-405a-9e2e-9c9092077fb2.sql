-- Security Fix: Add SET search_path = public to all SECURITY DEFINER functions
-- This prevents SQL injection and privilege escalation attacks
-- Zero risk: Only adds security layer without changing any logic

-- 1. get_current_user_organization_id
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT organization_id 
    FROM public.profiles 
    WHERE user_id = auth.uid();
$function$;

-- 2. is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.user_id = $1 AND role = 'super_admin'
    );
$function$;

-- 3. can_access_reports
CREATE OR REPLACE FUNCTION public.can_access_reports()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'reports_manager')
    );
$function$;

-- 4. can_manage_plus_payments
CREATE OR REPLACE FUNCTION public.can_manage_plus_payments()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'reception')
    );
$function$;

-- 5. get_active_assignments_count
CREATE OR REPLACE FUNCTION public.get_active_assignments_count(order_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT COUNT(*)::integer
    FROM appointment_order_assignments aoa
    JOIN appointments a ON aoa.appointment_id = a.id
    WHERE aoa.medical_order_id = order_id_param
    AND a.status IN ('scheduled', 'confirmed', 'in_progress', 'completed');
$function$;

-- 6. validate_appointment_assignment_capacity
CREATE OR REPLACE FUNCTION public.validate_appointment_assignment_capacity(order_id_param uuid, additional_sessions integer DEFAULT 1)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT 
        CASE 
            WHEN mo.total_sessions IS NULL THEN true
            ELSE (get_active_assignments_count(order_id_param) + additional_sessions) <= mo.total_sessions
        END
    FROM medical_orders mo
    WHERE mo.id = order_id_param;
$function$;

-- 7. get_medical_orders_with_availability
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
SET search_path = public
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
    AND mo.completed = false
    AND mo.total_sessions > get_active_assignments_count(mo.id)
    AND mo.total_sessions > 0
    ORDER BY 
        mo.urgent DESC,
        mo.created_at DESC;
$function$;

-- 8. check_presentation_ready
CREATE OR REPLACE FUNCTION public.check_presentation_ready(order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_order medical_orders%ROWTYPE;
    v_completed_sessions INTEGER := 0;
BEGIN
    SELECT * INTO v_order
    FROM medical_orders
    WHERE id = order_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF COALESCE(v_order.completed, false) = true THEN
        RETURN true;
    END IF;

    SELECT COUNT(*)
    INTO v_completed_sessions
    FROM appointment_order_assignments aoa
    JOIN appointments a ON a.id = aoa.appointment_id
    WHERE aoa.medical_order_id = order_id
      AND a.status = 'completed';

    RETURN v_completed_sessions >= COALESCE(v_order.total_sessions, 0);
END;
$function$;

-- 9. get_daily_cash_summary
CREATE OR REPLACE FUNCTION public.get_daily_cash_summary(target_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
    total_income numeric, 
    total_expenses numeric, 
    net_balance numeric, 
    transaction_count bigint, 
    last_reconciliation_date date, 
    is_reconciled boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT 
    COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END), 0) as net_balance,
    COUNT(*) as transaction_count,
    (SELECT MAX(reconciliation_date) FROM cash_reconciliation WHERE is_closed = true) as last_reconciliation_date,
    EXISTS(SELECT 1 FROM cash_reconciliation WHERE reconciliation_date = target_date AND is_closed = true) as is_reconciled
  FROM cash_transactions 
  WHERE transaction_date = target_date;
$function$;

-- 10. get_daily_plus_stats
CREATE OR REPLACE FUNCTION public.get_daily_plus_stats(target_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
    total_amount numeric, 
    cash_amount numeric, 
    transfer_amount numeric, 
    mercado_pago_amount numeric, 
    total_payments bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT 
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN amount ELSE 0 END), 0) as transfer_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'mercado_pago' THEN amount ELSE 0 END), 0) as mercado_pago_amount,
        COUNT(*) as total_payments
    FROM plus_payments 
    WHERE payment_date = target_date;
$function$;

-- 11. get_plus_payments_report
CREATE OR REPLACE FUNCTION public.get_plus_payments_report(
    start_date date DEFAULT NULL::date, 
    end_date date DEFAULT NULL::date, 
    professional_filter uuid DEFAULT NULL::uuid, 
    payment_method_filter payment_method DEFAULT NULL::payment_method
)
RETURNS TABLE(
    payment_id uuid, 
    patient_name text, 
    professional_name text, 
    obra_social_name text, 
    amount numeric, 
    payment_method payment_method, 
    payment_date date, 
    observations text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT 
        pp.id as payment_id,
        CONCAT(pt_profile.first_name, ' ', pt_profile.last_name) as patient_name,
        CASE 
            WHEN pp.professional_id IS NOT NULL 
            THEN CONCAT(prof_profile.first_name, ' ', prof_profile.last_name)
            ELSE 'Sin asignar'
        END as professional_name,
        osa.nombre as obra_social_name,
        pp.amount,
        pp.payment_method,
        pp.payment_date,
        pp.observations
    FROM plus_payments pp
    JOIN patients pt ON pp.patient_id = pt.id
    JOIN profiles pt_profile ON pt.profile_id = pt_profile.id
    LEFT JOIN obras_sociales_art osa ON pt.obra_social_art_id = osa.id
    LEFT JOIN doctors d ON pp.professional_id = d.id
    LEFT JOIN profiles prof_profile ON d.profile_id = prof_profile.id
    WHERE 
        (start_date IS NULL OR pp.payment_date >= start_date)
        AND (end_date IS NULL OR pp.payment_date <= end_date)
        AND (professional_filter IS NULL OR pp.professional_id = professional_filter)
        AND (payment_method_filter IS NULL OR pp.payment_method = payment_method_filter)
    ORDER BY pp.payment_date DESC, pp.created_at DESC;
$function$;

-- 12. validate_order_assignment_capacity
CREATE OR REPLACE FUNCTION public.validate_order_assignment_capacity(order_id_param uuid, requested_sessions integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_order medical_orders%ROWTYPE;
    v_active_assignments integer;
    v_sessions_remaining integer;
    v_result jsonb;
BEGIN
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
    
    IF v_order.completed = true THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'ORDEN_COMPLETADA',
            'message', 'No se pueden asignar turnos a una orden ya completada'
        );
    END IF;
    
    SELECT get_active_assignments_count(order_id_param) INTO v_active_assignments;
    v_sessions_remaining := v_order.total_sessions - v_active_assignments;
    
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

-- 13. generate_final_summary_for_completed_order
CREATE OR REPLACE FUNCTION public.generate_final_summary_for_completed_order(order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_medical_order medical_orders%ROWTYPE;
    v_unified_history_id UUID;
    v_final_summary JSONB;
BEGIN
    SELECT * INTO v_medical_order
    FROM medical_orders
    WHERE id = order_id AND completed = true;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Orden médica % no encontrada o no completada', order_id;
        RETURN FALSE;
    END IF;
    
    SELECT id INTO v_unified_history_id
    FROM unified_medical_histories
    WHERE medical_order_id = order_id;
    
    IF v_unified_history_id IS NULL THEN
        INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data, organization_id)
        VALUES (order_id, v_medical_order.patient_id, '{}', v_medical_order.organization_id)
        RETURNING id INTO v_unified_history_id;
        
        RAISE NOTICE 'Historia unificada creada para orden %', order_id;
    END IF;
    
    SELECT template_data->'final_summary' INTO v_final_summary
    FROM unified_medical_histories
    WHERE id = v_unified_history_id;
    
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

-- 14. get_current_user_profile_id
CREATE OR REPLACE FUNCTION public.get_current_user_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT id FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- 15. revert_appointment_status
CREATE OR REPLACE FUNCTION public.revert_appointment_status(appointment_uuid uuid, revert_reason_text text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    current_appointment appointments%ROWTYPE;
    target_status appointment_status;
    medical_order_record medical_orders%ROWTYPE;
    current_user_profile_id UUID;
    latest_history_record appointment_status_history%ROWTYPE;
BEGIN
    SELECT id INTO current_user_profile_id 
    FROM profiles 
    WHERE user_id = auth.uid();
    
    IF current_user_profile_id IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;
    
    SELECT * INTO current_appointment
    FROM appointments
    WHERE id = appointment_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;
    
    SELECT * INTO latest_history_record
    FROM appointment_status_history
    WHERE appointment_id = appointment_uuid
    AND action_type = 'status_change'
    AND reverted_at IS NULL
    ORDER BY changed_at DESC
    LIMIT 1;
    
    CASE current_appointment.status
        WHEN 'completed' THEN
            target_status := 'scheduled';
        WHEN 'no_show' THEN
            target_status := 'scheduled';
        WHEN 'no_show_session_lost' THEN
            target_status := 'scheduled';
        WHEN 'cancelled' THEN
            target_status := 'scheduled';
        ELSE
            RAISE EXCEPTION 'Cannot revert appointment with status: %', current_appointment.status;
    END CASE;
    
    UPDATE appointments 
    SET 
        status = target_status,
        pardoned_by = current_user_profile_id,
        pardoned_at = NOW(),
        pardon_reason = revert_reason_text,
        updated_at = NOW()
    WHERE id = appointment_uuid;
    
    IF current_appointment.status = 'no_show_session_lost' THEN
        SELECT * INTO medical_order_record
        FROM medical_orders
        WHERE patient_id = current_appointment.patient_id
        AND completed = false
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF FOUND THEN
            IF medical_order_record.sessions_used > 0 THEN
                UPDATE medical_orders
                SET 
                    sessions_used = sessions_used - 1,
                    updated_at = NOW()
                WHERE id = medical_order_record.id;
                
                IF medical_order_record.completed AND medical_order_record.sessions_used = medical_order_record.total_sessions THEN
                    UPDATE medical_orders
                    SET 
                        completed = false,
                        completed_at = NULL,
                        updated_at = NOW()
                    WHERE id = medical_order_record.id;
                END IF;
            END IF;
        END IF;
    END IF;
    
    IF latest_history_record.id IS NOT NULL THEN
        UPDATE appointment_status_history
        SET 
            reverted_at = NOW(),
            reverted_by = current_user_profile_id,
            revert_reason = revert_reason_text
        WHERE id = latest_history_record.id;
    END IF;
    
    INSERT INTO appointment_status_history (
        appointment_id,
        old_status,
        new_status,
        changed_by,
        reason,
        action_type
    ) VALUES (
        appointment_uuid,
        current_appointment.status,
        target_status,
        current_user_profile_id,
        revert_reason_text,
        'reversion'
    );
    
    RETURN TRUE;
END;
$function$;

-- 16. get_real_session_count
CREATE OR REPLACE FUNCTION public.get_real_session_count(patient_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT COUNT(*)::INTEGER
    FROM appointments
    WHERE patient_id = patient_uuid
    AND status = 'completed';
$function$;