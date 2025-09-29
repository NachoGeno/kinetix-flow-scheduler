import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with service role
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the user data from the request
    const { first_name, last_name, email, password, role, organization_id } = await req.json();

    if (!first_name || !last_name || !email || !password || !role || !organization_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the user in auth with admin privileges
    const { data: authUser, error: authError } = await supabaseServiceRole.auth.admin.createUser({
      email: email,
      password: password,
      user_metadata: {
        first_name: first_name,
        last_name: last_name,
        role: role,
        organization_id: organization_id
      },
      email_confirm: true // Auto-confirm the email
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the profile with the correct organization and role
    if (authUser.user) {
      const { error: updateError } = await supabaseServiceRole
        .from('profiles')
        .update({
          role: role,
          organization_id: organization_id
        })
        .eq('user_id', authUser.user.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        // Don't fail the whole operation for this
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authUser.user?.id,
          email: authUser.user?.email,
          first_name: first_name,
          last_name: last_name,
          role: role,
          organization_id: organization_id
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-user-admin function:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});