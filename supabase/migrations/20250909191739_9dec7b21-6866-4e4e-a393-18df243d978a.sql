-- Crear función helper para verificar si un usuario es secretaria
CREATE OR REPLACE FUNCTION public.is_secretaria(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.user_id = $1 AND role = 'secretaria'
    );
$$;

-- Crear función helper para verificar permisos administrativos (solo admin y super_admin para facturación y reportes)
CREATE OR REPLACE FUNCTION public.can_access_admin_only_modules()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    );
$$;

-- Crear función helper para verificar permisos de secretaria (secretaria tiene acceso a la mayoría de módulos)
CREATE OR REPLACE FUNCTION public.can_access_secretaria_modules()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'secretaria', 'reception')
    );
$$;