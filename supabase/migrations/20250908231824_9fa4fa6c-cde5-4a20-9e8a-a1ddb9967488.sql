-- CREAR PRIMER SUPER ADMIN
-- Actualizar un usuario existente a super_admin (reemplaza con tu email)

UPDATE public.profiles 
SET role = 'super_admin'
WHERE email = 'igenovese@grupoorange.ar'  -- Cambiar por tu email
AND organization_id = 'a0000000-0000-0000-0000-000000000001';

-- Verificar que se creó correctamente
SELECT id, email, role, organization_id 
FROM public.profiles 
WHERE role = 'super_admin';