import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DashboardStats {
  activePatientsCount: number;
  todayAppointmentsCount: number;
  pendingOrdersCount: number;
  completedSessionsRate: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use anon key instead of service role to respect RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    // Get current user to ensure they're authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    console.log(`Fetching dashboard stats for date: ${today}`);

    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    // All queries will be automatically filtered by organization through RLS
    const [
      { count: activePatientsCount },
      { count: todayAppointmentsCount },
      { count: pendingOrdersCount },
      { data: monthlyAppointments }
    ] = await Promise.all([
      supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      
      supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('appointment_date', today)
        .in('status', ['scheduled', 'confirmed', 'in_progress']),
      
      supabase
        .from('medical_orders')
        .select('*', { count: 'exact', head: true })
        .eq('completed', false),
      
      supabase
        .from('appointments')
        .select('status')
        .gte('appointment_date', firstDayOfMonth)
        .lte('appointment_date', today)
    ]);

    const completedCount = monthlyAppointments?.filter(apt => apt.status === 'completed').length || 0;
    const totalCount = monthlyAppointments?.length || 0;
    const completedSessionsRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const stats: DashboardStats = {
      activePatientsCount: activePatientsCount || 0,
      todayAppointmentsCount: todayAppointmentsCount || 0,
      pendingOrdersCount: pendingOrdersCount || 0,
      completedSessionsRate,
    };

    console.log(`Dashboard stats calculated: ${JSON.stringify(stats)}`);

    return new Response(JSON.stringify(stats), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    });

  } catch (error) {
    console.error('Error in dashboard-stats function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});