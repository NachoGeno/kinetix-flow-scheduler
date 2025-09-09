-- Corregir el error de la función get_user_role

-- Eliminar la función existente
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- Crear la función con search_path configurado
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER  
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE user_id = user_uuid;
$$;