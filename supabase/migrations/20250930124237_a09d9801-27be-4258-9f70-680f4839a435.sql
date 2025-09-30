
-- Corrección quirúrgica para Dionisia Gallardo (DNI: 21957848)
-- Paciente ID: 1700a869-2c61-4412-905f-489ba2c60dc8

-- PASO 0: Deshabilitar triggers temporalmente usando session_replication_role
SET session_replication_role = replica;

-- PASO 1: Resetear sessions_used a 0 en ambas órdenes médicas
UPDATE medical_orders
SET 
    sessions_used = 0,
    updated_at = NOW()
WHERE id IN (
    '8f5a7f72-ac2c-4507-b0ee-c7e3a1e0fde3',  -- DX TX RODILLA IZQ
    '328bfb70-3ee9-4014-b757-940417b0b839'   -- DX ESGUINCE MUÑECA DER
)
AND patient_id = '1700a869-2c61-4412-905f-489ba2c60dc8';

-- PASO 2: Cancelar las citas problemáticas del 16/09/2025
UPDATE appointments
SET 
    status = 'cancelled',
    notes = COALESCE(notes || ' | ', '') || '[CORRECCIÓN: Cita marcada como completada sin session_deducted, cancelada para corregir desincronización]',
    updated_at = NOW()
WHERE id IN (
    'd5151faf-6d04-414c-b895-1d43b2dd4834',
    'c7c16a57-9d1a-40c6-98c0-0eb8a0bdc591'
)
AND patient_id = '1700a869-2c61-4412-905f-489ba2c60dc8'
AND appointment_date = '2025-09-16'
AND status = 'completed'
AND session_deducted = false;

-- PASO 3: Reactivar triggers
SET session_replication_role = default;
