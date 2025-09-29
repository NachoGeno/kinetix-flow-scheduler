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
        created_at,
        patient:patients(
          profile:profiles(
            first_name,
            last_name
          )
        ),
        doctor:doctors(
          profile:profiles(
            first_name,
            last_name
          ),
          specialty:specialties(
            name
          )
        )
      `)
      .gte('appointment_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 30 days
      .order('created_at', { ascending: false })
      .limit(10);

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      throw appointmentsError;
    }

    // Transform appointments into activity format
    const activities = appointments?.map((appointment: any) => {
      const patientName = appointment.patient?.profile 
        ? `${appointment.patient.profile.first_name || ''} ${appointment.patient.profile.last_name || ''}`.trim()
        : 'Paciente no disponible';
      
      const doctorName = appointment.doctor?.profile 
        ? `${appointment.doctor.profile.first_name || ''} ${appointment.doctor.profile.last_name || ''}`.trim()
        : 'Doctor no asignado';
      
      const specialtyName = appointment.doctor?.specialty?.name || 'Especialidad no especificada';
      
      let title = '';
      let description = '';
      let type = 'appointment';
      let statusDisplay = appointment.status;

      switch (appointment.status) {
        case 'completed':
          title = 'Sesión completada';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          statusDisplay = 'completed';
          break;
        case 'scheduled':
          title = 'Turno programado';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          statusDisplay = 'new';
          break;
        case 'confirmed':
          title = 'Turno confirmado';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          statusDisplay = 'confirmed';
          break;
        case 'cancelled':
          title = 'Turno cancelado';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          statusDisplay = 'cancelled';
          break;
        case 'no_show':
          title = 'Paciente no asistió';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          statusDisplay = 'no_show';
          break;
        case 'in_progress':
          title = 'Sesión en progreso';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          statusDisplay = 'pending';
          break;
        default:
          title = 'Actividad de turno';
          description = `${patientName} - ${specialtyName} con Dr. ${doctorName}`;
          statusDisplay = 'new';
      }

      // Format the time nicely
      const appointmentDate = new Date(appointment.appointment_date);
      const timeFormatted = new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(`${appointment.appointment_date}T${appointment.appointment_time}`));

      return {
        id: appointment.id,
        type,
        title,
        description,
        time: timeFormatted,
        status: statusDisplay,
        created_at: appointment.created_at || appointment.appointment_date
      };
    }).filter(activity => activity !== null) || [];

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