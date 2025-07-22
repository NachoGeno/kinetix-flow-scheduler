-- Limpieza completa de datos de prueba manteniendo estructura y usuario admin

-- 1. Eliminar evolutivos clínicos (progress_notes)
DELETE FROM public.progress_notes;

-- 2. Eliminar registros médicos (medical_records)
DELETE FROM public.medical_records;

-- 3. Eliminar turnos/citas (appointments)
DELETE FROM public.appointments;

-- 4. Eliminar órdenes médicas (medical_orders)
DELETE FROM public.medical_orders;

-- 5. Eliminar pacientes
DELETE FROM public.patients;

-- 6. Eliminar doctores
DELETE FROM public.doctors;

-- 7. Eliminar archivos del storage
DELETE FROM storage.objects WHERE bucket_id IN ('medical-orders', 'mediturnos2614');

-- 8. Eliminar perfiles de usuarios que no sean admin
-- Mantener solo los perfiles con rol 'admin'
DELETE FROM public.profiles WHERE role != 'admin';

-- 9. Eliminar usuarios de auth que no tengan perfil de admin
-- (solo los que ya no tienen perfil asociado tras el paso anterior)
DELETE FROM auth.users 
WHERE id NOT IN (
  SELECT user_id FROM public.profiles WHERE role = 'admin' AND user_id IS NOT NULL
);

-- Mostrar resumen de la limpieza
SELECT 
  'patients' as tabla, COUNT(*) as registros_restantes FROM public.patients
UNION ALL
SELECT 
  'doctors' as tabla, COUNT(*) as registros_restantes FROM public.doctors
UNION ALL
SELECT 
  'appointments' as tabla, COUNT(*) as registros_restantes FROM public.appointments
UNION ALL
SELECT 
  'medical_orders' as tabla, COUNT(*) as registros_restantes FROM public.medical_orders
UNION ALL
SELECT 
  'progress_notes' as tabla, COUNT(*) as registros_restantes FROM public.progress_notes
UNION ALL
SELECT 
  'medical_records' as tabla, COUNT(*) as registros_restantes FROM public.medical_records
UNION ALL
SELECT 
  'profiles' as tabla, COUNT(*) as registros_restantes FROM public.profiles
UNION ALL
SELECT 
  'storage_objects' as tabla, COUNT(*) as registros_restantes FROM storage.objects
WHERE bucket_id IN ('medical-orders', 'mediturnos2614');