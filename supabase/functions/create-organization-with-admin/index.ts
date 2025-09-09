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

    // Step 1: Create organization using the database function
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

    const organizationId = orgResult.organization_id;
    console.log('Organization created:', organizationId);

    // Step 2: Create admin user using Supabase Admin API
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

    // Step 3: Create profile for admin user
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authUser.user.id,
        first_name: admin_first_name,
        last_name: admin_last_name,
        email: admin_email,
        phone: admin_phone,
        role: 'admin',
        organization_id: organizationId
      });

    if (profileError) {
      console.error('Error creating admin profile:', profileError);
      
      // Cleanup: Delete user and organization
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin
        .from('organizations')
        .delete()
        .eq('id', organizationId);

      return new Response(
        JSON.stringify({ error: `Admin profile creation failed: ${profileError.message}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('Admin profile created successfully');

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