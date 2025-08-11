import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PresentationItem {
  patient_id: string;
  patient_name: string;
  medical_order_id: string;
  medical_order_attachment: string | null;
  has_clinical_evolution: boolean;
  has_attendance_file: boolean;
  attendance_file_url: string | null;
  is_complete: boolean;
}

interface SendEmailRequest {
  type: "presentation" | "social_appointments";
  obra_social_id?: string | null;
  subject?: string;
  message?: string;
  // For presentations
  items?: PresentationItem[];
  // For social appointments (server will query if not provided)
  date_from?: string; // YYYY-MM-DD
  date_to?: string;   // YYYY-MM-DD
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as SendEmailRequest;

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    if (!Deno.env.get("RESEND_API_KEY")) {
      throw new Error("Missing RESEND_API_KEY secret");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") as string;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") || "" },
      },
    });

    // Load settings
    const { data: settings } = await supabase
      .from("email_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings?.default_sender_email) {
      throw new Error("Configure un remitente en Configuración > Email");
    }

    const emailType = payload.type === "presentation" ? "presentation" : "social_appointments";

    // Load recipients (specific OS if provided, else global ones where obra_social_art_id is null)
    let recipientsQuery = supabase
      .from("email_recipients")
      .select("email")
      .eq("email_type", emailType)
      .eq("is_active", true);

    if (payload.obra_social_id) {
      recipientsQuery = recipientsQuery.eq("obra_social_art_id", payload.obra_social_id);
    } else {
      recipientsQuery = recipientsQuery.is("obra_social_art_id", null);
    }

    const { data: recipients, error: recipientsError } = await recipientsQuery;
    if (recipientsError) throw recipientsError;

    const toEmails = (recipients || []).map((r: any) => r.email).filter(Boolean);
    if (toEmails.length === 0) {
      throw new Error(
        payload.obra_social_id
          ? "No hay destinatarios configurados para esta Obra/ART"
          : "No hay destinatarios globales configurados para turnos sociales"
      );
    }

    // Build content
    let subject = payload.subject ||
      (payload.type === "presentation" ? "Presentaciones de pacientes" : "Turnos sociales");

    let html = "";

    if (payload.type === "presentation") {
      const items = payload.items || [];
      const rows = items
        .map(
          (it) => `
          <tr>
            <td style="padding:8px;border:1px solid #eee;">${it.patient_name}</td>
            <td style="padding:8px;border:1px solid #eee;">${it.medical_order_attachment ? "Sí" : "No"}</td>
            <td style="padding:8px;border:1px solid #eee;">${it.has_clinical_evolution ? "Sí" : "No"}</td>
            <td style="padding:8px;border:1px solid #eee;">${it.has_attendance_file ? (it.attendance_file_url ? `<a href="${it.attendance_file_url}">Ver</a>` : "Sí") : "No"}</td>
            <td style="padding:8px;border:1px solid #eee;">${it.is_complete ? "Completa" : "Incompleta"}</td>
          </tr>`
        )
        .join("");

      html = `
        <h2>Presentaciones</h2>
        ${payload.message ? `<p>${payload.message}</p>` : ""}
        <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border:1px solid #eee;">Paciente</th>
              <th style="text-align:left;padding:8px;border:1px solid #eee;">Orden Médica</th>
              <th style="text-align:left;padding:8px;border:1px solid #eee;">Evolutivo</th>
              <th style="text-align:left;padding:8px;border:1px solid #eee;">Asistencia</th>
              <th style="text-align:left;padding:8px;border:1px solid #eee;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    } else {
      // Social appointments - fetch if not provided
      const dateFrom = payload.date_from || new Date().toISOString().slice(0, 10);
      const dateTo = payload.date_to || dateFrom;

      // Build query with joins
      let query = supabase
        .from("appointments")
        .select(
          `appointment_date, appointment_time, status,
           patients!inner(id, obra_social_art_id, profiles(first_name,last_name)),
           doctors!inner(profiles(first_name,last_name))`
        )
        .gte("appointment_date", dateFrom)
        .lte("appointment_date", dateTo);

      if (payload.obra_social_id) {
        query = query.eq("patients.obra_social_art_id", payload.obra_social_id);
      } else {
        // Only social (patients linked to an obra social)
        query = query.not("patients.obra_social_art_id", "is", null);
      }

      const { data: appts, error: apptsError } = await query;
      if (apptsError) throw apptsError;

      const rows = (appts || [])
        .map((a: any) => {
          const patientName = `${a.patients.profiles.first_name} ${a.patients.profiles.last_name}`;
          const doctorName = `${a.doctors.profiles.first_name} ${a.doctors.profiles.last_name}`;
          return `
            <tr>
              <td style="padding:8px;border:1px solid #eee;">${a.appointment_date} ${a.appointment_time}</td>
              <td style="padding:8px;border:1px solid #eee;">${patientName}</td>
              <td style="padding:8px;border:1px solid #eee;">${doctorName}</td>
              <td style="padding:8px;border:1px solid #eee;">${a.status}</td>
            </tr>
          `;
        })
        .join("");

      subject = payload.subject || `Turnos sociales ${dateFrom === dateTo ? dateFrom : `${dateFrom} a ${dateTo}`}`;

      html = `
        <h2>Turnos sociales</h2>
        ${payload.message ? `<p>${payload.message}</p>` : ""}
        <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border:1px solid #eee;">Fecha y hora</th>
              <th style="text-align:left;padding:8px;border:1px solid #eee;">Paciente</th>
              <th style="text-align:left;padding:8px;border:1px solid #eee;">Profesional</th>
              <th style="text-align:left;padding:8px;border:1px solid #eee;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }

    const fromHeader = `${settings.default_sender_name} <${settings.default_sender_email}>`;

    const result = await resend.emails.send({
      from: fromHeader,
      to: toEmails,
      subject,
      html,
      reply_to: settings.reply_to || undefined,
    } as any);

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("send-email error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
