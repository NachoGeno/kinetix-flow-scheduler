-- Actualizar política RLS de profiles para permitir acceso a roles administrativos

-- Primero, eliminamos la política restrictiva actual
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Creamos una nueva política más permisiva que incluye roles administrativos
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (
  -- Los usuarios pueden ver su propio perfil
  (auth.uid() = user_id) 
  OR 
  -- Roles administrativos y doctores pueden ver perfiles de pacientes de su organización
  (
    (role = 'patient'::user_role) 
    AND 
    (organization_id = get_current_user_organization_id())
    AND
    (
      is_admin(auth.uid()) 
      OR 
      get_user_role(auth.uid()) IN ('doctor'::user_role, 'reception'::user_role, 'secretaria'::user_role, 'reports_manager'::user_role, 'gerencia'::user_role)
    )
  )
);