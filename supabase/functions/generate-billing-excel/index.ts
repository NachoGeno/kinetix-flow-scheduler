import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BillingData {
  invoiceId: string;
  obraSocialId: string;
  presentations: any[];
  columnConfig?: any[];
}

/**
 * Sanitiza nombres de archivo para Supabase Storage
 * - Remueve diacríticos (ñ → n, á → a)
 * - Reemplaza caracteres no alfanuméricos con _
 * - Compacta múltiples _ consecutivos
 */
function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')                          // Descompone caracteres con diacríticos
    .replace(/[\u0300-\u036f]/g, '')          // Remueve marcas diacríticas
    .replace(/ñ/gi, 'n')                      // Ñ → n (específico)
    .replace(/[^a-zA-Z0-9._-]/g, '_')         // Solo permite: letras, números, . _ -
    .replace(/_+/g, '_')                      // Compacta _____ → _
    .replace(/^_|_$/g, '');                   // Trim _ al inicio/fin
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { invoiceId, obraSocialId, presentations, columnConfig }: BillingData = await req.json();

    console.log('Generating Excel for invoice:', invoiceId, 'with', presentations.length, 'presentations');

    // Default columns if no config provided
    const defaultColumns = [
      { field: 'patient_name', label: 'Paciente', order: 0 },
      { field: 'patient_dni', label: 'DNI', order: 1 },
      { field: 'order_number', label: 'N° Orden', order: 2 },
      { field: 'order_date', label: 'Fecha Orden', order: 3 },
      { field: 'sessions_total', label: 'Sesiones Totales', order: 4 },
      { field: 'sessions_used', label: 'Sesiones Realizadas', order: 5 },
    ];

    const columns = columnConfig && columnConfig.length > 0 ? columnConfig : defaultColumns;
    columns.sort((a, b) => a.order - b.order);

    // Prepare data for Excel
    const excelData = presentations.map((presentation) => {
      const row: any = {};
      
      columns.forEach(col => {
        switch(col.field) {
          case 'patient_name':
            row[col.label] = presentation.patient_name || '';
            break;
          case 'patient_dni':
            row[col.label] = presentation.patient_dni || '';
            break;
          case 'order_number':
            row[col.label] = presentation.order_id || '';
            break;
          case 'order_date':
            row[col.label] = presentation.order_date ? new Date(presentation.order_date).toLocaleDateString('es-AR') : '';
            break;
          case 'sessions_total':
            row[col.label] = presentation.total_sessions || 0;
            break;
          case 'sessions_used':
            row[col.label] = presentation.sessions_used || 0;
            break;
          case 'doctor_name':
            row[col.label] = presentation.doctor_name || '';
            break;
          case 'order_type':
            row[col.label] = presentation.order_type || '';
            break;
          case 'completion_date':
            row[col.label] = presentation.completed_at ? new Date(presentation.completed_at).toLocaleDateString('es-AR') : '';
            break;
        }
      });
      
      return row;
    });

    // Get obra social name
    const { data: obraSocial } = await supabaseClient
      .from('obras_sociales_art')
      .select('nombre')
      .eq('id', obraSocialId)
      .single();

    // Create workbook
    const wb: any = { SheetNames: [], Sheets: {} };
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Auto-size columns
    const cols = columns.map(() => ({ wch: 20 }));
    ws['!cols'] = cols;

    // Add worksheet to workbook
    const sheetName = `Facturación ${obraSocial?.nombre || 'OS'}`;
    wb.SheetNames.push(sheetName);
    wb.Sheets[sheetName] = ws;

    // Generate Excel buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = sanitizeFileName(
      `facturacion_${obraSocial?.nombre || 'OS'}_${timestamp}.xlsx`
    );
    console.log(`📊 Excel filename sanitized: ${filename}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('billing-files')
      .upload(`invoices/${invoiceId}/${filename}`, excelBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    // Update billing invoice with file info
    const { error: updateError } = await supabaseClient
      .from('billing_invoices')
      .update({
        file_name: filename,
        file_url: uploadData.path,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    console.log('Excel generated successfully:', filename);

    return new Response(
      JSON.stringify({
        success: true,
        filename,
        path: uploadData.path,
        url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/billing-files/${uploadData.path}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error generating Excel:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});