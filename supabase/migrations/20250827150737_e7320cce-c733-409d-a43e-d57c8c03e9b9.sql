-- CRITICAL FIX: Reset all incorrectly completed medical orders
-- This will correct the massive data integrity issue where orders are marked as completed
-- without patients actually attending the sessions

-- Step 1: Create a function to safely reset incorrectly completed orders
CREATE OR REPLACE FUNCTION fix_medical_orders_data_integrity()
RETURNS TABLE(
    order_id UUID,
    patient_name TEXT,
    old_sessions_used INTEGER,
    new_sessions_used INTEGER,
    old_completed BOOLEAN,
    new_completed BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    real_completed_count INTEGER;
    should_be_completed BOOLEAN;
BEGIN
    -- Log the start of the correction process
    RAISE NOTICE 'Starting medical orders data integrity correction...';
    
    -- Process each medical order that might have integrity issues
    FOR rec IN 
        SELECT 
            mo.id,
            mo.patient_id,
            mo.sessions_used,
            mo.total_sessions,
            mo.completed,
            CONCAT(p.first_name, ' ', p.last_name) as patient_name
        FROM medical_orders mo
        JOIN patients pt ON mo.patient_id = pt.id
        JOIN profiles p ON pt.profile_id = p.id
        ORDER BY mo.created_at DESC
    LOOP
        -- Count REAL completed appointments for this patient
        SELECT COUNT(*)
        INTO real_completed_count
        FROM appointments a
        WHERE a.patient_id = rec.patient_id
        AND a.status = 'completed';
        
        -- Determine if order should actually be completed
        should_be_completed := real_completed_count >= rec.total_sessions;
        
        -- Only update if there's a discrepancy
        IF rec.sessions_used != real_completed_count OR rec.completed != should_be_completed THEN
            
            -- Update the medical order with correct data
            UPDATE medical_orders 
            SET 
                sessions_used = real_completed_count,
                completed = should_be_completed,
                completed_at = CASE 
                    WHEN should_be_completed AND completed_at IS NULL THEN NOW()
                    WHEN NOT should_be_completed THEN NULL
                    ELSE completed_at
                END,
                updated_at = NOW()
            WHERE id = rec.id;
            
            -- Return the correction details
            order_id := rec.id;
            patient_name := rec.patient_name;
            old_sessions_used := rec.sessions_used;
            new_sessions_used := real_completed_count;
            old_completed := rec.completed;
            new_completed := should_be_completed;
            
            RETURN NEXT;
            
            RAISE NOTICE 'Fixed order % for %: sessions % → %, completed % → %', 
                rec.id, rec.patient_name, rec.sessions_used, real_completed_count, rec.completed, should_be_completed;
        END IF;
        
    END LOOP;
    
    RAISE NOTICE 'Medical orders data integrity correction completed.';
    RETURN;
END;
$$;

-- Step 2: Add validation to prevent future integrity issues
CREATE OR REPLACE FUNCTION validate_medical_order_sessions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    real_completed_sessions INTEGER;
BEGIN
    -- Only validate if sessions_used or completed is being changed
    IF TG_OP = 'UPDATE' AND (
        NEW.sessions_used != OLD.sessions_used OR 
        NEW.completed != OLD.completed
    ) THEN
        
        -- Count real completed appointments for this patient
        SELECT COUNT(*)
        INTO real_completed_sessions
        FROM appointments a
        WHERE a.patient_id = NEW.patient_id
        AND a.status = 'completed';
        
        -- Prevent sessions_used from being higher than real completed sessions
        -- unless it's being updated by an appointment completion trigger
        IF NEW.sessions_used > real_completed_sessions + 1 THEN
            RAISE EXCEPTION 'Cannot set sessions_used (%) higher than real completed appointments (%)', 
                NEW.sessions_used, real_completed_sessions;
        END IF;
        
        -- Prevent marking as completed if not enough real sessions
        IF NEW.completed = true AND real_completed_sessions < NEW.total_sessions THEN
            RAISE EXCEPTION 'Cannot mark order as completed: only % of % sessions actually completed', 
                real_completed_sessions, NEW.total_sessions;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$;

-- Step 3: Create the validation trigger
DROP TRIGGER IF EXISTS validate_medical_order_sessions_trigger ON medical_orders;
CREATE TRIGGER validate_medical_order_sessions_trigger
    BEFORE UPDATE ON medical_orders
    FOR EACH ROW
    EXECUTE FUNCTION validate_medical_order_sessions();

-- Step 4: Add a function to get accurate session counts
CREATE OR REPLACE FUNCTION get_real_session_count(patient_uuid UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM appointments
    WHERE patient_id = patient_uuid
    AND status = 'completed';
$$;