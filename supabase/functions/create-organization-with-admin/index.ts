import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrgWithAdminRequest {
  // Organization data
  name: string;
  subdomain: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  max_users?: number;
  max_patients?: number;
  plan_type?: string;
  primary_color?: string;
  secondary_color?: string;
  
  // Admin user data
  admin_email: string;
  admin_password: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_phone?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const {
      name,
      subdomain,
      contact_email,
      contact_phone,
      address,
      max_users = 50,
      max_patients = 1000,
      plan_type = 'basic',
      primary_color = '#3B82F6',
      secondary_color = '#1E40AF',
      admin_email,
      admin_password,
      admin_first_name,
      admin_last_name,
      admin_phone
    }: CreateOrgWithAdminRequest = await req.json();

    console.log('Creating organization with admin:', { name, subdomain, admin_email });

    // Validate required fields
    if (!name || !subdomain || !admin_email || !admin_password || !admin_first_name || !admin_last_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Step 1: Check if admin email already exists
    const { data: existingUser, error: userCheckError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userCheckError) {
      console.error('Error checking existing users:', userCheckError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate admin email' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const emailExists = existingUser.users.some(user => user.email === admin_email);
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: `Email ${admin_email} is already in use` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Step 2: Create organization using the database function
    const { data: orgResult, error: orgError } = await supabaseAdmin.rpc('create_organization_with_validation', {
      org_name: name,
      org_subdomain: subdomain,
      org_contact_email: contact_email,
      org_contact_phone: contact_phone,
      org_address: address,
      org_max_users: max_users,
      org_max_patients: max_patients,
      org_plan_type: plan_type,
      org_primary_color: primary_color,
      org_secondary_color: secondary_color
    });

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return new Response(
        JSON.stringify({ error: `Organization creation failed: ${orgError.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const organizationId = orgResult[0]?.organization_id;
    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Failed to get organization ID from database' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    console.log('Organization created:', organizationId);

    // Step 3: Create admin user using Supabase Admin API
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true, // Auto-confirm email for admin users
      user_metadata: {
        first_name: admin_first_name,
        last_name: admin_last_name
      }
    });

    if (authError) {
      console.error('Error creating admin user:', authError);
      
      // Cleanup: Delete the organization if user creation failed
      await supabaseAdmin
        .from('organizations')
        .delete()
        .eq('id', organizationId);

      return new Response(
        JSON.stringify({ error: `Admin user creation failed: ${authError.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Admin user created:', authUser.user.id);

    // Step 4: Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 5: Update the profile that was automatically created by the trigger
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        first_name: admin_first_name,
        last_name: admin_last_name,
        email: admin_email,
        phone: admin_phone,
        role: 'admin',
        organization_id: organizationId
      })
      .eq('user_id', authUser.user.id);

    if (profileError) {
      console.error('Error updating admin profile:', profileError);
      
      // Cleanup: Delete user and organization
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin
        .from('organizations')
        .delete()
        .eq('id', organizationId);

      return new Response(
        JSON.stringify({ error: `Admin profile update failed: ${profileError.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Admin profile updated successfully');

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        organization_id: organizationId,
        admin_user_id: authUser.user.id,
        message: 'Organization and administrator created successfully',
        admin_credentials: {
          email: admin_email,
          // Don't return password in response for security
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Unexpected error in create-organization-with-admin:', error);
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${error.message}` }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);