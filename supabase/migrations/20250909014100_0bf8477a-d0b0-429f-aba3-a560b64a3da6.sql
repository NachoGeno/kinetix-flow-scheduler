-- Simplemente sobrescribir la función get_user_role con search_path

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER  
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE profiles.user_id = $1;
$$;