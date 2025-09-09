-- Revertir todos los datos de Rehabilitare San lorenzo a Rehabilitare1
-- Mantener solo el perfil del usuario en Rehabilitare San lorenzo

-- IDs de organizaciones
-- Rehabilitare1: a0000000-0000-0000-0000-000000000001
-- Rehabilitare San lorenzo: d2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67

-- 1. Mover especialidades
UPDATE specialties 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 2. Mover obras sociales
UPDATE obras_sociales_art 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 3. Mover doctores
UPDATE doctors 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 4. Mover pacientes
UPDATE patients 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 5. Mover órdenes médicas
UPDATE medical_orders 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 6. Mover citas
UPDATE appointments 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 7. Mover historias médicas unificadas
UPDATE unified_medical_histories 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 8. Mover notas de progreso (no tiene organization_id directo, se maneja por relaciones)

-- 9. Mover registros médicos
UPDATE medical_records 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 10. Mover pagos plus
UPDATE plus_payments 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 11. Mover transacciones de efectivo  
UPDATE cash_transactions 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 12. Mover novedades
UPDATE novedades 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- 13. Mover categorías de gastos
UPDATE expense_categories 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id = 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';

-- NOTA: Los perfiles (profiles) NO se mueven - el usuario debe permanecer en Rehabilitare San lorenzo
-- NOTA: Otras tablas como appointment_status_history, medical_history_entries, etc. 
-- no tienen organization_id directo y se manejan por relaciones con las tablas principales

-- Verificar que Rehabilitare San lorenzo quede vacía (excepto el perfil del usuario)
-- El usuario ahora debería ver una organización completamente nueva y vacía