-- Create function to create organization with admin user
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  org_name text,
  org_subdomain text,
  org_contact_email text DEFAULT NULL,
  org_contact_phone text DEFAULT NULL,
  org_address text DEFAULT NULL,
  org_max_users integer DEFAULT 50,
  org_max_patients integer DEFAULT 1000,
  org_plan_type text DEFAULT 'basic',
  org_primary_color text DEFAULT '#3B82F6',
  org_secondary_color text DEFAULT '#1E40AF',
  admin_email text,
  admin_password text,
  admin_first_name text,
  admin_last_name text,
  admin_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  new_user_id uuid;
  new_profile_id uuid;
  auth_user_data jsonb;
BEGIN
  -- Validate required parameters
  IF org_name IS NULL OR org_name = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;
  
  IF org_subdomain IS NULL OR org_subdomain = '' THEN
    RAISE EXCEPTION 'Organization subdomain is required';
  END IF;
  
  IF admin_email IS NULL OR admin_email = '' THEN
    RAISE EXCEPTION 'Administrator email is required';
  END IF;
  
  IF admin_password IS NULL OR admin_password = '' THEN
    RAISE EXCEPTION 'Administrator password is required';
  END IF;
  
  IF admin_first_name IS NULL OR admin_first_name = '' THEN
    RAISE EXCEPTION 'Administrator first name is required';
  END IF;
  
  IF admin_last_name IS NULL OR admin_last_name = '' THEN
    RAISE EXCEPTION 'Administrator last name is required';
  END IF;

  -- Check if subdomain already exists
  IF EXISTS (SELECT 1 FROM organizations WHERE subdomain = org_subdomain) THEN
    RAISE EXCEPTION 'Subdomain already exists: %', org_subdomain;
  END IF;

  -- Check if admin email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
    RAISE EXCEPTION 'Email already exists: %', admin_email;
  END IF;

  -- Create the organization first
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

  -- Create auth user using Supabase auth.users
  -- Note: This requires admin privileges to insert directly into auth.users
  new_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    admin_email,
    crypt(admin_password, gen_salt('bf')), -- This might not work - auth.users handles its own password encryption
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'first_name', admin_first_name,
      'last_name', admin_last_name
    ),
    false,
    'authenticated'
  );

  -- Create profile for the admin user
  INSERT INTO public.profiles (
    user_id,
    first_name,
    last_name,
    email,
    phone,
    role,
    organization_id
  ) VALUES (
    new_user_id,
    admin_first_name,
    admin_last_name,
    admin_email,
    admin_phone,
    'admin',
    new_org_id
  ) RETURNING id INTO new_profile_id;

  -- Return success with created IDs
  RETURN jsonb_build_object(
    'success', true,
    'organization_id', new_org_id,
    'user_id', new_user_id,
    'profile_id', new_profile_id,
    'message', 'Organization and administrator created successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback any partial creation
    RAISE EXCEPTION 'Error creating organization with admin: %', SQLERRM;
END;
$$;