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
    AND is_super_admin_only(auth.uid()) = true
    ORDER BY p.created_at DESC;
$function$;