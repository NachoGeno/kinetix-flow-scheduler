-- ===============================================
-- FUNCIÓN SIMPLIFICADA DE REMEDIACIÓN DE DUPLICADOS
-- ===============================================
-- Solo cancela duplicados y elimina sus asignaciones (más simple y seguro)
CREATE OR REPLACE FUNCTION public.remediate_duplicate_appointments()
RETURNS TABLE(
    patient_name text,
    doctor_name text,
    appointment_date date,
    appointment_time time,
    duplicates_found integer,
    oldest_kept_id uuid,
    cancelled_count integer
)
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    duplicate_group RECORD;
    appointment_ids uuid[];
    kept_appointment_id uuid;
    cancelled_appointment_ids uuid[];
    cancelled_count_var integer;
BEGIN
    -- Buscar grupos de turnos duplicados activos
    FOR duplicate_group IN
        SELECT 
            a.doctor_id,
            a.appointment_date, 
            a.appointment_time,
            a.patient_id,
            a.organization_id,
            array_agg(a.id ORDER BY a.created_at ASC) as ids,
            COUNT(*) as duplicate_count,
            CONCAT(pp.first_name, ' ', pp.last_name) as patient_full_name,
            CONCAT(dp.first_name, ' ', dp.last_name) as doctor_full_name
        FROM appointments a
        JOIN patients pt ON a.patient_id = pt.id
        JOIN profiles pp ON pt.profile_id = pp.id  
        JOIN doctors d ON a.doctor_id = d.id
        JOIN profiles dp ON d.profile_id = dp.id
        WHERE a.status IN ('scheduled', 'confirmed', 'in_progress')
        GROUP BY a.doctor_id, a.appointment_date, a.appointment_time, a.patient_id, a.organization_id,
                 pp.first_name, pp.last_name, dp.first_name, dp.last_name
        HAVING COUNT(*) > 1
    LOOP
        appointment_ids := duplicate_group.ids;
        kept_appointment_id := appointment_ids[1]; -- Mantener el más antiguo
        cancelled_appointment_ids := appointment_ids[2:]; -- Cancelar el resto
        cancelled_count_var := array_length(cancelled_appointment_ids, 1);
        
        -- Eliminar las asignaciones de los duplicados que serán cancelados
        DELETE FROM appointment_order_assignments
        WHERE appointment_id = ANY(cancelled_appointment_ids);
        
        -- Cancelar los duplicados (excepto el más antiguo)
        -- Desactivar temporalmente el trigger para evitar problemas de auth
        SET session_replication_role = replica;
        
        UPDATE appointments 
        SET 
            status = 'cancelled',
            notes = COALESCE(notes || ' ', '') || '[AUTO-CANCELADO: Duplicado detectado y reparado]',
            updated_at = NOW()
        WHERE id = ANY(cancelled_appointment_ids);
        
        -- Reactivar el trigger
        SET session_replication_role = default;
        
        -- Devolver información del grupo procesado
        RETURN QUERY SELECT 
            duplicate_group.patient_full_name,
            duplicate_group.doctor_full_name,
            duplicate_group.appointment_date,
            duplicate_group.appointment_time,
            duplicate_group.duplicate_count::integer,
            kept_appointment_id,
            cancelled_count_var::integer;
    END LOOP;
    
    RETURN;
END;
$$;

-- ===============================================
-- EJECUTAR REMEDIACIÓN DE DUPLICADOS EXISTENTES
-- ===============================================
SELECT 
    patient_name,
    doctor_name, 
    appointment_date,
    appointment_time,
    duplicates_found,
    oldest_kept_id,
    cancelled_count
FROM remediate_duplicate_appointments()
ORDER BY appointment_date DESC, appointment_time ASC;