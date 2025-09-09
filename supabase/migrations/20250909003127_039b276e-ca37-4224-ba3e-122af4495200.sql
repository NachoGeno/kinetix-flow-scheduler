-- Drop the previous function if it exists
DROP FUNCTION IF EXISTS public.create_organization_with_admin;

-- Create a simpler function that just creates the organization
-- User creation will be handled via Supabase Admin API in an edge function
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
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- Validate required parameters
  IF org_name IS NULL OR org_name = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;
  
  IF org_subdomain IS NULL OR org_subdomain = '' THEN
    RAISE EXCEPTION 'Organization subdomain is required';
  END IF;

  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM organizations WHERE subdomain = org_subdomain) THEN
    RAISE EXCEPTION 'Subdomain already exists: %', org_subdomain;
  END IF;

  -- Create the organization
  INSERT INTO public.organizations (
    name,
    subdomain,
    contact_email,
    contact_phone,
    address,
    max_users,
    max_patients,
    plan_type,
    primary_color,
    secondary_color,
    is_active
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
    org_secondary_color,
    true
  ) RETURNING id INTO new_org_id;

  -- Return success with created organization ID
  RETURN jsonb_build_object(
    'success', true,
    'organization_id', new_org_id,
    'message', 'Organization created successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating organization: %', SQLERRM;
END;
$$;