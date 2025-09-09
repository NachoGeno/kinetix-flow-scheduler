-- Drop existing function and recreate with correct signature
DROP FUNCTION IF EXISTS public.create_organization_with_validation(text,text,text,text,text,integer,integer,text,text,text);

-- Create the organization validation function
CREATE OR REPLACE FUNCTION public.create_organization_with_validation(
    org_name text,
    org_subdomain text,
    org_contact_email text DEFAULT NULL,
    org_contact_phone text DEFAULT NULL,
    org_address text DEFAULT NULL,
    org_max_users integer DEFAULT 50,
    org_max_patients integer DEFAULT 1000,
    org_plan_type text DEFAULT 'basic',
    org_primary_color text DEFAULT '#3B82F6',
    org_secondary_color text DEFAULT '#1E40AF'
) RETURNS TABLE(organization_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- Check if subdomain already exists (if provided)
    IF org_subdomain IS NOT NULL AND EXISTS (
        SELECT 1 FROM organizations WHERE subdomain = org_subdomain
    ) THEN
        RAISE EXCEPTION 'Subdomain already exists: %', org_subdomain;
    END IF;
    
    -- Insert new organization
    INSERT INTO organizations (
        name,
        subdomain,
        contact_email,
        contact_phone,
        address,
        max_users,
        max_patients,
        plan_type,
        primary_color,
        secondary_color
    ) VALUES (
        org_name,
        org_subdomain,
        org_contact_email,
        org_contact_phone,
        org_address,
        org_max_users,
        org_max_patients,
        org_plan_type,
        org_primary_color,
        org_secondary_color
    ) RETURNING id INTO new_org_id;
    
    -- Return the organization ID
    RETURN QUERY SELECT new_org_id;
END;
$$;