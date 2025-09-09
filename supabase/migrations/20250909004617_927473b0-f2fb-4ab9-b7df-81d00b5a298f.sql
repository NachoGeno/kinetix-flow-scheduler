-- Modify is_admin function to include super_admin role
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.user_id = $1 AND role IN ('admin', 'super_admin')
    );
$function$

-- Create specific function for super admin checks
CREATE OR REPLACE FUNCTION public.is_super_admin_only(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.user_id = $1 AND role = 'super_admin'
    );
$function$

-- Function to get all users across organizations for super admins
CREATE OR REPLACE FUNCTION public.get_all_users_for_super_admin()
RETURNS TABLE(
    profile_id uuid,
    user_id uuid,
    first_name text,
    last_name text,
    email text,
    role user_role,
    phone text,
    created_at timestamp with time zone,
    avatar_url text,
    organization_id uuid,
    organization_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT 
        p.id as profile_id,
        p.user_id,
        p.first_name,
        p.last_name,
        p.email,
        p.role,
        p.phone,
        p.created_at,
        p.avatar_url,
        p.organization_id,
        o.name as organization_name
    FROM profiles p
    LEFT JOIN organizations o ON p.organization_id = o.id
    WHERE p.user_id IS NOT NULL
    ORDER BY p.created_at DESC;
$function$