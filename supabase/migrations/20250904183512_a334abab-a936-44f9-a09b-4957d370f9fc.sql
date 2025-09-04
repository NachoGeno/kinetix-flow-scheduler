-- Create appointment status history table for auditing
CREATE TABLE public.appointment_status_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID NOT NULL,
    old_status appointment_status,
    new_status appointment_status NOT NULL,
    changed_by UUID NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    reason TEXT,
    action_type TEXT NOT NULL DEFAULT 'status_change', -- 'status_change', 'reversion'
    reverted_at TIMESTAMP WITH TIME ZONE,
    reverted_by UUID,
    revert_reason TEXT
);

-- Enable RLS
ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all appointment history" 
ON public.appointment_status_history 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Reception can view appointment history" 
ON public.appointment_status_history 
FOR SELECT 
USING (can_manage_plus_payments());

CREATE POLICY "Doctors can view their appointment history" 
ON public.appointment_status_history 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    JOIN profiles p ON d.profile_id = p.id
    WHERE a.id = appointment_status_history.appointment_id
    AND p.user_id = auth.uid()
));

-- Function to revert appointment status
CREATE OR REPLACE FUNCTION public.revert_appointment_status(
    appointment_uuid UUID,
    revert_reason_text TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_appointment appointments%ROWTYPE;
    target_status appointment_status;
    medical_order_record medical_orders%ROWTYPE;
    current_user_profile_id UUID;
    latest_history_record appointment_status_history%ROWTYPE;
BEGIN
    -- Get current user profile
    SELECT id INTO current_user_profile_id 
    FROM profiles 
    WHERE user_id = auth.uid();
    
    IF current_user_profile_id IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;
    
    -- Get current appointment
    SELECT * INTO current_appointment
    FROM appointments
    WHERE id = appointment_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment not found';
    END IF;
    
    -- Get the latest status change (not reversion) for this appointment
    SELECT * INTO latest_history_record
    FROM appointment_status_history
    WHERE appointment_id = appointment_uuid
    AND action_type = 'status_change'
    AND reverted_at IS NULL
    ORDER BY changed_at DESC
    LIMIT 1;
    
    -- Determine target status based on current status
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
    
    -- Update appointment status
    UPDATE appointments 
    SET 
        status = target_status,
        pardoned_by = current_user_profile_id,
        pardoned_at = NOW(),
        pardon_reason = revert_reason_text,
        updated_at = NOW()
    WHERE id = appointment_uuid;
    
    -- Handle medical order session restoration if needed
    IF current_appointment.status = 'no_show_session_lost' THEN
        -- Find related medical order and restore session
        SELECT * INTO medical_order_record
        FROM medical_orders
        WHERE patient_id = current_appointment.patient_id
        AND completed = false
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF FOUND THEN
            -- Restore session if sessions_used > 0
            IF medical_order_record.sessions_used > 0 THEN
                UPDATE medical_orders
                SET 
                    sessions_used = sessions_used - 1,
                    updated_at = NOW()
                WHERE id = medical_order_record.id;
                
                -- If order was completed due to this session, revert completion
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
    
    -- Mark the latest history record as reverted
    IF latest_history_record.id IS NOT NULL THEN
        UPDATE appointment_status_history
        SET 
            reverted_at = NOW(),
            reverted_by = current_user_profile_id,
            revert_reason = revert_reason_text
        WHERE id = latest_history_record.id;
    END IF;
    
    -- Insert reversion record
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
$$;

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION public.log_appointment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    current_user_profile_id UUID;
BEGIN
    -- Only log if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Get current user profile
        SELECT id INTO current_user_profile_id 
        FROM profiles 
        WHERE user_id = auth.uid();
        
        -- Insert status change record
        INSERT INTO appointment_status_history (
            appointment_id,
            old_status,
            new_status,
            changed_by,
            action_type
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            COALESCE(current_user_profile_id, NEW.pardoned_by),
            'status_change'
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER appointment_status_change_log
    AFTER UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION log_appointment_status_change();