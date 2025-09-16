-- Crear trigger para recalcular cuando cambie status de cita (completar migración anterior)
DROP TRIGGER IF EXISTS trigger_recalc_on_status_change ON appointments;
CREATE TRIGGER trigger_recalc_on_status_change
    AFTER UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION handle_appointment_status_change_for_orders();

-- Recalcular todas las órdenes existentes con el nuevo sistema
DO $$
DECLARE
    patient_record RECORD;
    total_patients INTEGER := 0;
BEGIN
    -- Contar total de pacientes para progreso
    SELECT COUNT(DISTINCT patient_id) INTO total_patients 
    FROM medical_orders;
    
    RAISE NOTICE 'Iniciando recálculo para % pacientes...', total_patients;
    
    -- Recalcular por cada paciente que tenga órdenes médicas
    FOR patient_record IN 
        SELECT DISTINCT patient_id 
        FROM medical_orders 
        ORDER BY patient_id
    LOOP
        PERFORM recalc_patient_order_sessions_with_assignments(patient_record.patient_id);
    END LOOP;
    
    RAISE NOTICE 'Recálculo completado para todos los pacientes';
END $$;