-- FASE 1 - PARTE 2 (LIMPIA): Recrear tabla user_roles completamente
-- ====================================================================

-- 1. Eliminar todo lo anterior si existe
DROP POLICY IF EXISTS "Super admins and gerencia can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can update all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Gerencia can update org roles" ON public.user_roles;

DROP TABLE IF EXISTS public.user_roles CASCADE;

-- 2. Crear tabla user_roles (segura y separada)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Migrar datos actuales de profiles.role → user_roles
INSERT INTO public.user_roles (user_id, role, organization_id)
SELECT user_id, role, organization_id 
FROM profiles 
WHERE user_id IS NOT NULL;

-- 4. Crear función segura has_role() (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Crear función get_user_role_from_table()
CREATE OR REPLACE FUNCTION public.get_user_role_from_table(_user_id UUID)
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- 6. Actualizar función is_admin() para incluir gerencia y leer de user_roles
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = $1 
    AND role IN ('admin', 'super_admin', 'gerencia')
  )
$$;

-- 7. Actualizar función get_user_role() para leer de user_roles con fallback
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_roles.user_id = $1),
    (SELECT role FROM public.profiles WHERE profiles.user_id = $1),
    'patient'::user_role
  )
$$;

-- 8. RLS Policies para user_roles

CREATE POLICY "Super admins and gerencia can view all roles"
ON public.user_roles FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin') 
  OR public.has_role(auth.uid(), 'gerencia')
);

CREATE POLICY "Super admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update all roles"
ON public.user_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Gerencia can update org roles"
ON public.user_roles FOR UPDATE
USING (
  public.has_role(auth.uid(), 'gerencia')
  AND organization_id = get_current_user_organization_id()
  AND role != 'super_admin'
  AND (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) != 'super_admin'
)
WITH CHECK (
  public.has_role(auth.uid(), 'gerencia')
  AND organization_id = get_current_user_organization_id()
  AND role != 'super_admin'
);

-- 9. Comentarios de auditoría
COMMENT ON TABLE public.user_roles IS 'Tabla segura para gestión de roles de usuario - Fase 1 implementada';
COMMENT ON FUNCTION public.has_role IS 'Función SECURITY DEFINER para verificar roles sin recursión RLS';
COMMENT ON FUNCTION public.get_user_role_from_table IS 'Obtiene el rol del usuario desde user_roles';
COMMENT ON FUNCTION public.is_admin IS 'Verifica si usuario es admin/super_admin/gerencia desde user_roles';
COMMENT ON FUNCTION public.get_user_role IS 'Obtiene rol con fallback a profiles.role para compatibilidad';