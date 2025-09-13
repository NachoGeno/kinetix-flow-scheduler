-- Create appointment_order_assignments table
CREATE TABLE public.appointment_order_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    medical_order_id UUID NOT NULL REFERENCES public.medical_orders(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES public.profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(appointment_id) -- Each appointment can only be assigned to one order
);

-- Enable RLS
ALTER TABLE public.appointment_order_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Organization isolation - appointment_order_assignments select" 
ON public.appointment_order_assignments 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM appointments a 
        WHERE a.id = appointment_id 
        AND a.organization_id = get_current_user_organization_id()
    )
);

CREATE POLICY "Organization isolation - appointment_order_assignments insert" 
ON public.appointment_order_assignments 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM appointments a 
        WHERE a.id = appointment_id 
        AND a.organization_id = get_current_user_organization_id()
    )
);

CREATE POLICY "Organization isolation - appointment_order_assignments update" 
ON public.appointment_order_assignments 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM appointments a 
        WHERE a.id = appointment_id 
        AND a.organization_id = get_current_user_organization_id()
    )
);

CREATE POLICY "Organization isolation - appointment_order_assignments delete" 
ON public.appointment_order_assignments 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM appointments a 
        WHERE a.id = appointment_id 
        AND a.organization_id = get_current_user_organization_id()
    ) AND is_admin(auth.uid())
);

-- Update the session recalculation function to prioritize explicit assignments
CREATE OR REPLACE FUNCTION public.recalc_patient_order_sessions_with_assignments(patient_uuid uuid)
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
    should_be_completed BOOLEAN;
    old_sessions INTEGER;
    old_completed_status BOOLEAN;
    assigned_sessions INTEGER;
    remaining_sessions INTEGER;
BEGIN
    RAISE NOTICE 'Patient % - Starting session recalculation with assignments', patient_uuid;
    
    -- First pass: Count explicitly assigned sessions for each order
    FOR order_rec IN 
        SELECT 
            mo.id,
            mo.order_date,
            mo.total_sessions,
            mo.sessions_used,
            mo.completed,
            mo.created_at
        FROM medical_orders mo
        WHERE mo.patient_id = patient_uuid
        ORDER BY mo.order_date ASC, mo.created_at ASC
    LOOP
        -- Store old values
        old_sessions := order_rec.sessions_used;
        old_completed_status := order_rec.completed;
        sessions_for_this_order := 0;
        
        -- Count explicitly assigned completed sessions
        SELECT COUNT(*)
        INTO assigned_sessions
        FROM appointment_order_assignments aoa
        JOIN appointments a ON aoa.appointment_id = a.id
        WHERE aoa.medical_order_id = order_rec.id
        AND a.status = 'completed';
        
        -- Add assigned sessions
        sessions_for_this_order := assigned_sessions;
        
        RAISE NOTICE 'Order % - Assigned sessions: %', order_rec.id, assigned_sessions;
        
        -- Update cursor for FIFO allocation
        completed_sessions_cursor := completed_sessions_cursor + sessions_for_this_order;
        
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
            
        RAISE NOTICE 'Order % - Sessions: % -> %, Completed: % -> %', 
            order_rec.id, old_sessions, sessions_for_this_order,
            old_completed_status, should_be_completed;
    END LOOP;
    
    -- Second pass: FIFO allocation for unassigned completed sessions
    SELECT COUNT(*)
    INTO remaining_sessions
    FROM appointments a
    WHERE a.patient_id = patient_uuid
    AND a.status = 'completed'
    AND NOT EXISTS (
        SELECT 1 FROM appointment_order_assignments aoa 
        WHERE aoa.appointment_id = a.id
    );
    
    completed_sessions_cursor := 0;
    
    -- Only allocate unassigned sessions via FIFO if there are any
    IF remaining_sessions > 0 THEN
        FOR order_rec IN 
            SELECT 
                mo.id,
                mo.order_date,
                mo.total_sessions,
                mo.sessions_used,
                mo.completed,
                mo.created_at
            FROM medical_orders mo
            WHERE mo.patient_id = patient_uuid
            ORDER BY mo.order_date ASC, mo.created_at ASC
        LOOP
            -- Skip if order is already completed by assignments
            IF order_rec.completed THEN
                CONTINUE;
            END IF;
            
            -- Calculate how many more sessions this order needs
            sessions_for_this_order := LEAST(
                order_rec.total_sessions - order_rec.sessions_used,
                remaining_sessions - completed_sessions_cursor
            );
            
            IF sessions_for_this_order > 0 THEN
                -- Update sessions used
                UPDATE medical_orders
                SET 
                    sessions_used = sessions_used + sessions_for_this_order,
                    completed = (sessions_used + sessions_for_this_order) >= total_sessions,
                    completed_at = CASE 
                        WHEN (sessions_used + sessions_for_this_order) >= total_sessions THEN NOW()
                        ELSE completed_at
                    END,
                    updated_at = NOW()
                WHERE id = order_rec.id;
                
                completed_sessions_cursor := completed_sessions_cursor + sessions_for_this_order;
                
                RAISE NOTICE 'Order % - Added % unassigned sessions via FIFO', 
                    order_rec.id, sessions_for_this_order;
            END IF;
            
            -- Stop if we've allocated all unassigned sessions
            IF completed_sessions_cursor >= remaining_sessions THEN
                EXIT;
            END IF;
        END LOOP;
    END IF;
END;
$$;

-- Update the trigger to use the new function
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
        
        RAISE NOTICE 'Appointment % completed for patient %, recalculating sessions with assignments', NEW.id, NEW.patient_id;
        
        -- Recalculate all session counts for this patient using assignments + FIFO
        FOR fix_result IN 
            SELECT * FROM public.recalc_patient_order_sessions_with_assignments(NEW.patient_id)
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
            RAISE NOTICE 'No orders completed with this appointment, sessions updated via assignments + FIFO';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;