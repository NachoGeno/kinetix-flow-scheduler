import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { writeXLSX, utils } from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'Missing startDate or endDate parameters' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: appointments, error } = await supabaseClient
      .from('appointments')
      .select('*, patient:patients(*)')
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate);

    if (error) {
      throw error;
    }

    const data = appointments.map((apt) => ({
      Fecha: apt.appointment_date,
      Hora: apt.appointment_time,
      Paciente: apt.patient?.full_name,
      Estado: apt.status,
    }));

    const worksheet = utils.json_to_sheet(data);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Turnos');

    const xlsxOutput = writeXLSX(workbook, { type: 'array' });
    const xlsxBlob = new Blob([xlsxOutput], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    return new Response(xlsxBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="turnos.xlsx"',
      },
    });
  } catch (error) {
    console.error('Error generating Excel:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
