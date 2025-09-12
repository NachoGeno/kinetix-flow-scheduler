-- Now update sessions_used to include both completed and absent sessions
UPDATE medical_orders 
SET sessions_used = (
  SELECT COALESCE(COUNT(*), 0)
  FROM appointments a
  WHERE a.patient_id = medical_orders.patient_id
  AND a.status IN ('completed', 'no_show_session_lost')
  AND a.appointment_date >= medical_orders.order_date
)
WHERE completed = false;

-- Mark orders as completed if they have reached their total sessions
UPDATE medical_orders 
SET completed = true,
    completed_at = NOW()
WHERE completed = false 
AND sessions_used >= total_sessions;