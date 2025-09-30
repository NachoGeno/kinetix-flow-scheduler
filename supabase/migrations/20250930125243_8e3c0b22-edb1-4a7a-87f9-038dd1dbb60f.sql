-- Solución definitiva: Marcar todos los turnos agendados de Dionisia Gallardo como completados
-- Paciente: Dionisia Gallardo (DNI: 21957848)
-- Patient ID: 1700a869-2c61-4412-905f-489ba2c60dc8

-- Deshabilitar triggers temporalmente
SET session_replication_role = replica;

-- Marcar todos los 10 turnos agendados como completados
UPDATE appointments
SET 
    status = 'completed',
    session_deducted = true,
    notes = COALESCE(notes || ' | ', '') || '[RESOLUCIÓN ADMINISTRATIVA: Turno marcado como completado para sincronizar órdenes médicas]',
    updated_at = NOW()
WHERE id IN (
    -- 5 turnos de la orden "DX TX RODILLA IZQ" (8f5a7f72-ac2c-4507-b0ee-c7e3a1e0fde3)
    '05fc5f52-f2e3-468e-97c7-3b0f5efe1f77',
    '18bfa1ba-6d1c-4dfa-8a87-b0c02dc4fe21',
    '55c55e45-d7be-4ae4-8006-e35db8d7f4bc',
    '6ec74d3f-1a6c-4cf3-9c56-d4b10ea7d2e4',
    'ae5c4eae-8df2-4ffe-8876-c0e9cd29c2f9',
    -- 5 turnos de la orden "DX ESGUINCE MUÑECA DER" (328bfb70-3ee9-4014-b757-940417b0b839)
    '4a2b81df-fccb-420b-9c79-db09a8c1fad2',
    '65d3baae-e086-420e-b8d6-5c3f71eaa27f',
    '8c19c17e-6e17-4e7a-ba6c-f0e3c7d5a3db',
    'c52aa8be-7024-4b33-8eb5-b7c04b8e95b5',
    'eadd75c8-7c67-4577-897a-f77e09ef3972'
)
AND patient_id = '1700a869-2c61-4412-905f-489ba2c60dc8'
AND status = 'scheduled';

-- Reactivar triggers
SET session_replication_role = default;

-- Verificación: Mostrar el estado de las órdenes médicas después de la actualización
SELECT 
    mo.id,
    mo.description,
    mo.total_sessions,
    mo.sessions_used,
    mo.completed,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments
FROM medical_orders mo
LEFT JOIN appointment_order_assignments aoa ON mo.id = aoa.medical_order_id
LEFT JOIN appointments a ON aoa.appointment_id = a.id
WHERE mo.patient_id = '1700a869-2c61-4412-905f-489ba2c60dc8'
GROUP BY mo.id, mo.description, mo.total_sessions, mo.sessions_used, mo.completed;