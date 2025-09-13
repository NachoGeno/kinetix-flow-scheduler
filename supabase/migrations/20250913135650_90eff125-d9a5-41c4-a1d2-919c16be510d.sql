-- Fix security warnings by setting search_path for new functions

-- 1. Fix audit function
CREATE OR REPLACE FUNCTION public.audit_patient_session_allocation(patient_uuid uuid DEFAULT NULL)
RETURNS TABLE(
    patient_id uuid,
    patient_name text,
    order_id uuid,
    order_date date,
    total_sessions integer,
    current_sessions_used integer,
    calculated_fifo_sessions integer,
    discrepancy integer,
    order_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    patient_rec RECORD;
    order_rec RECORD;
    completed_sessions_cursor INTEGER;
    sessions_for_this_order INTEGER;
BEGIN
    -- Process specific patient or all patients
    FOR patient_rec IN 
        SELECT DISTINCT 
            mo.patient_id,
            CONCAT(p.first_name, ' ', p.last_name) as name
        FROM medical_orders mo
        JOIN patients pt ON mo.patient_id = pt.id
        JOIN profiles p ON pt.profile_id = p.id
        WHERE (patient_uuid IS NULL OR mo.patient_id = patient_uuid)
        ORDER BY name
    LOOP
        completed_sessions_cursor := 0;
        
        -- Process each patient's medical orders chronologically (FIFO)
        FOR order_rec IN 
            SELECT 
                mo.id,
                mo.patient_id,
                mo.order_date,
                mo.total_sessions,
                mo.sessions_used,
                mo.completed,
                patient_rec.name
            FROM medical_orders mo
            WHERE mo.patient_id = patient_rec.patient_id
            ORDER BY mo.order_date ASC, mo.created_at ASC
        LOOP
            -- Count total completed appointments for this patient
            -- that occurred after this order's date
            WITH patient_completed_sessions AS (
                SELECT COUNT(*) as total_completed
                FROM appointments a
                WHERE a.patient_id = order_rec.patient_id
                AND a.status = 'completed'
                AND a.appointment_date >= order_rec.order_date
            )
            SELECT 
                CASE 
                    WHEN pcs.total_completed > completed_sessions_cursor THEN
                        LEAST(order_rec.total_sessions, pcs.total_completed - completed_sessions_cursor)
                    ELSE 0
                END
            INTO sessions_for_this_order
            FROM patient_completed_sessions pcs;
            
            -- Update cursor for next order
            completed_sessions_cursor := completed_sessions_cursor + sessions_for_this_order;
            
            -- Return audit row
            RETURN QUERY SELECT
                order_rec.patient_id,
                order_rec.name,
                order_rec.id,
                order_rec.order_date,
                order_rec.total_sessions,
                order_rec.sessions_used,
                sessions_for_this_order,
                (order_rec.sessions_used - sessions_for_this_order) as discrepancy,
                CASE 
                    WHEN sessions_for_this_order >= order_rec.total_sessions THEN 'should_be_completed'
                    WHEN sessions_for_this_order > 0 THEN 'partially_used'
                    ELSE 'unused'
                END as order_status;
        END LOOP;
    END LOOP;
END;
$$;

-- 2. Fix FIFO Session Allocation Engine
CREATE OR REPLACE FUNCTION public.recalc_patient_order_sessions(patient_uuid uuid)
RETURNS TABLE(
    order_id uuid,
    old_sessions_used integer,
    new_sessions_used integer,
    old_completed boolean,
    new_completed boolean,
    action_taken text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    order_rec RECORD;
    completed_sessions_cursor INTEGER := 0;
    sessions_for_this_order INTEGER;
    total_patient_completed INTEGER;
    should_be_completed BOOLEAN;
    old_sessions INTEGER;
    old_completed_status BOOLEAN;
BEGIN
    -- Get total completed sessions for patient
    SELECT COUNT(*) INTO total_patient_completed
    FROM appointments a
    WHERE a.patient_id = patient_uuid
    AND a.status = 'completed';
    
    RAISE NOTICE 'Patient % has % total completed sessions', patient_uuid, total_patient_completed;
    
    -- Process orders chronologically (FIFO)
    FOR order_rec IN 
        SELECT 
            mo.id,
            mo.order_date,
            mo.total_sessions,
            mo.sessions_used,
            mo.completed
        FROM medical_orders mo
        WHERE mo.patient_id = patient_uuid
        ORDER BY mo.order_date ASC, mo.created_at ASC
    LOOP
        -- Store old values
        old_sessions := order_rec.sessions_used;
        old_completed_status := order_rec.completed;
        
        -- Count completed appointments that occurred after this order's date
        WITH order_completed_sessions AS (
            SELECT COUNT(*) as sessions_after_order
            FROM appointments a
            WHERE a.patient_id = patient_uuid
            AND a.status = 'completed'
            AND a.appointment_date >= order_rec.order_date
        )
        SELECT 
            CASE 
                WHEN ocs.sessions_after_order > completed_sessions_cursor THEN
                    LEAST(order_rec.total_sessions, ocs.sessions_after_order - completed_sessions_cursor)
                ELSE 0
            END
        INTO sessions_for_this_order
        FROM order_completed_sessions ocs;
        
        -- Determine if order should be completed
        should_be_completed := sessions_for_this_order >= order_rec.total_sessions;
        
        -- Update the medical order
        UPDATE medical_orders
        SET 
            sessions_used = sessions_for_this_order,
            completed = should_be_completed,
            completed_at = CASE 
                WHEN should_be_completed AND NOT order_rec.completed THEN NOW()
                WHEN NOT should_be_completed AND order_rec.completed THEN NULL
                ELSE completed_at
            END,
            updated_at = NOW()
        WHERE id = order_rec.id;
        
        -- Update cursor for next order
        completed_sessions_cursor := completed_sessions_cursor + sessions_for_this_order;
        
        -- Return the changes made
        RETURN QUERY SELECT
            order_rec.id,
            old_sessions,
            sessions_for_this_order,
            old_completed_status,
            should_be_completed,
            CASE 
                WHEN old_sessions != sessions_for_this_order OR old_completed_status != should_be_completed THEN 'updated'
                ELSE 'no_change'
            END;
            
        RAISE NOTICE 'Order % - Date: %, Sessions: % -> %, Completed: % -> %', 
            order_rec.id, order_rec.order_date, old_sessions, sessions_for_this_order,
            old_completed_status, should_be_completed;
    END LOOP;
END;
$$;

-- 3. Fix global backfill function
CREATE OR REPLACE FUNCTION public.fix_all_patient_session_counts()
RETURNS TABLE(
    patient_id uuid,
    patient_name text,
    orders_processed integer,
    orders_changed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    patient_rec RECORD;
    fix_result RECORD;
    orders_processed_count INTEGER;
    orders_changed_count INTEGER;
BEGIN
    -- Process each patient with medical orders
    FOR patient_rec IN 
        SELECT DISTINCT 
            mo.patient_id,
            CONCAT(p.first_name, ' ', p.last_name) as name
        FROM medical_orders mo
        JOIN patients pt ON mo.patient_id = pt.id
        JOIN profiles p ON pt.profile_id = p.id
        ORDER BY name
    LOOP
        orders_processed_count := 0;
        orders_changed_count := 0;
        
        -- Fix this patient's session counts
        FOR fix_result IN 
            SELECT * FROM public.recalc_patient_order_sessions(patient_rec.patient_id)
        LOOP
            orders_processed_count := orders_processed_count + 1;
            IF fix_result.action_taken = 'updated' THEN
                orders_changed_count := orders_changed_count + 1;
            END IF;
        END LOOP;
        
        -- Return patient summary
        RETURN QUERY SELECT
            patient_rec.patient_id,
            patient_rec.name,
            orders_processed_count,
            orders_changed_count;
    END LOOP;
END;
$$;

-- 4. Fix trigger function
CREATE OR REPLACE FUNCTION public.handle_appointment_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    fix_result RECORD;
    v_unified_history_id UUID;
    v_final_summary JSONB;
    v_order_completed BOOLEAN := FALSE;
BEGIN
    -- Only process if appointment is being marked as completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        RAISE NOTICE 'Appointment % completed for patient %, recalculating sessions', NEW.id, NEW.patient_id;
        
        -- Recalculate all session counts for this patient using FIFO
        FOR fix_result IN 
            SELECT * FROM public.recalc_patient_order_sessions(NEW.patient_id)
        LOOP
            -- Check if any order was just completed
            IF fix_result.new_completed = TRUE AND fix_result.old_completed = FALSE THEN
                v_order_completed := TRUE;
                
                RAISE NOTICE 'Order % was just completed, generating final summary', fix_result.order_id;
                
                -- Get or create unified_medical_history for the completed order
                SELECT id INTO v_unified_history_id
                FROM unified_medical_histories
                WHERE medical_order_id = fix_result.order_id;
                
                IF v_unified_history_id IS NULL THEN
                    INSERT INTO unified_medical_histories (medical_order_id, patient_id, template_data)
                    VALUES (fix_result.order_id, NEW.patient_id, '{}')
                    RETURNING id INTO v_unified_history_id;
                END IF;
                
                -- Generate final summary if it doesn't exist
                SELECT template_data->'final_summary' INTO v_final_summary
                FROM unified_medical_histories
                WHERE id = v_unified_history_id;
                
                IF v_final_summary IS NULL OR v_final_summary = 'null'::jsonb THEN
                    v_final_summary := jsonb_build_object(
                        'final_summary', jsonb_build_object(
                            'total_sessions_completed', fix_result.new_sessions_used,
                            'completion_date', NOW(),
                            'summary', 'Tratamiento completado según orden médica. Todas las sesiones han sido realizadas.',
                            'recommendations', 'Seguimiento según indicación médica.',
                            'generated_automatically', true
                        )
                    );
                    
                    UPDATE unified_medical_histories
                    SET template_data = COALESCE(template_data, '{}'::jsonb) || v_final_summary,
                        updated_at = NOW()
                    WHERE id = v_unified_history_id;
                    
                    RAISE NOTICE 'Final summary generated for completed order %', fix_result.order_id;
                END IF;
            END IF;
        END LOOP;
        
        IF NOT v_order_completed THEN
            RAISE NOTICE 'No orders completed with this appointment, sessions updated via FIFO';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;