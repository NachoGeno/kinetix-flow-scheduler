import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Activity {
  id: string;
  type: "appointment" | "patient" | "order";
  title: string;
  description: string;
  time: string;
  status: string;
  created_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching recent activity data...');

    // Execute all queries in parallel with proper joins to avoid N+1 queries
    const [
      { data: appointments },
      { data: patients },
      { data: orders }
    ] = await Promise.all([
      // Recent appointments with patient and doctor info in single query
      supabaseClient
        .from('appointments')
        .select(`
          id,
          status,
          created_at,
          updated_at,
          patients!inner(
            profiles!inner(first_name, last_name)
          ),
          doctors!inner(
            profiles!inner(first_name, last_name)
          )
        `)
        .order('updated_at', { ascending: false })
        .limit(5),
      
      // Recent patients
      supabaseClient
        .from('patients')
        .select(`
          id,
          created_at,
          profiles!inner(first_name, last_name, dni)
        `)
        .order('created_at', { ascending: false })
        .limit(3),
      
      // Recent medical orders with patient info
      supabaseClient
        .from('medical_orders')
        .select(`
          id,
          description,
          total_sessions,
          completed,
          created_at,
          patients!inner(
            profiles!inner(first_name, last_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(3)
    ]);

    const activities: Activity[] = [];

    // Process appointments
    appointments?.forEach(apt => {
      const patientProfile = apt.patients?.profiles;
      const doctorProfile = apt.doctors?.profiles;
      
      const patientName = patientProfile ? `${patientProfile.first_name} ${patientProfile.last_name}` : 'Paciente';
      const doctorName = doctorProfile ? `${doctorProfile.first_name} ${doctorProfile.last_name}` : 'Doctor';
      
      activities.push({
        id: apt.id,
        type: "appointment",
        title: `Turno ${getStatusText(apt.status)}`,
        description: `${patientName} - Dr. ${doctorName}`,
        time: formatDistanceToNow(apt.updated_at),
        status: apt.status,
        created_at: apt.updated_at
      });
    });

    // Process patients
    patients?.forEach(patient => {
      const profile = patient.profiles;
      activities.push({
        id: patient.id,
        type: "patient",
        title: "Nuevo paciente registrado",
        description: `${profile?.first_name} ${profile?.last_name} - DNI: ${profile?.dni || 'N/A'}`,
        time: formatDistanceToNow(patient.created_at),
        status: "new",
        created_at: patient.created_at
      });
    });

    // Process medical orders
    orders?.forEach(order => {
      const patientProfile = order.patients?.profiles;
      const patientName = patientProfile ? `${patientProfile.first_name} ${patientProfile.last_name}` : 'Paciente';
      
      activities.push({
        id: order.id,
        type: "order",
        title: "Orden médica cargada",
        description: `${order.description} - ${patientName}`,
        time: formatDistanceToNow(order.created_at),
        status: order.completed ? "completed" : "pending",
        created_at: order.created_at
      });
    });

    // Sort all activities by date and take top 8
    activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recentActivities = activities.slice(0, 8);

    console.log(`Recent activity fetched: ${recentActivities.length} items`);

    return new Response(JSON.stringify(recentActivities), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    });

  } catch (error) {
    console.error('Error in recent-activity function:', error);
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

function getStatusText(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmado';
    case 'new':
      return 'Nuevo';
    case 'pending':
      return 'Pendiente';
    case 'completed':
      return 'Completado';
    default:
      return status;
  }
}

function formatDistanceToNow(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInDays > 0) {
    return `hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
  } else if (diffInHours > 0) {
    return `hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
  } else {
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    return `hace ${Math.max(diffInMinutes, 1)} minuto${diffInMinutes > 1 ? 's' : ''}`;
  }
}