import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Fetching recent activity data...');

    // Get recent appointments from the current user's organization (RLS will handle filtering)
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        appointment_time,
        status,
        patient:patients!inner(
          profile:profiles!inner(
            first_name,
            last_name
          )
        ),
        doctor:doctors!inner(
          profile:profiles!inner(
            first_name,
            last_name
          ),
          specialty:specialties!inner(
            name
          )
        )
      `)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false })
      .limit(8);

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      throw appointmentsError;
    }

    // Transform appointments into activity format
    const activities = appointments?.map(appointment => {
      const patientName = `${appointment.patient.profile.first_name} ${appointment.patient.profile.last_name}`;
      const doctorName = `${appointment.doctor.profile.first_name} ${appointment.doctor.profile.last_name}`;
      const specialtyName = appointment.doctor.specialty.name;
      
      let title = '';
      let description = '';
      let type = 'appointment';

      switch (appointment.status) {
        case 'completed':
          title = 'Sesión completada';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          break;
        case 'scheduled':
          title = 'Turno programado';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          break;
        case 'cancelled':
          title = 'Turno cancelado';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          break;
        case 'no_show':
          title = 'Paciente no asistió';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          break;
        default:
          title = 'Actividad de turno';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
      }

      return {
        id: appointment.id,
        type,
        title,
        description,
        time: `${appointment.appointment_date} ${appointment.appointment_time}`,
        status: appointment.status,
        created_at: appointment.appointment_date
      };
    }) || [];

    console.log(`Recent activity fetched: ${activities.length} items`);

    return new Response(JSON.stringify(activities), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});