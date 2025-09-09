-- Corregir las funciones de seguridad para que tengan search_path configurado

-- Corregir la función get_current_user_organization_id
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id 
    FROM public.profiles 
    WHERE user_id = auth.uid();
$$;

-- Corregir la función is_admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.user_id = $1 AND role = 'admin'
    );
$$;

-- Corregir la función is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.user_id = $1 AND role = 'super_admin'
    );
$$;

-- Corregir la función get_current_user_profile_id  
CREATE OR REPLACE FUNCTION public.get_current_user_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Corregir la función can_manage_plus_payments
CREATE OR REPLACE FUNCTION public.can_manage_plus_payments()
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'reception')
    );
$$;

-- Crear función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER  
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE user_id = user_uuid;
$$;