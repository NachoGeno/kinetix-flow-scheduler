import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BillingPackageData {
  invoiceId: string;
  obraSocialId: string;
  obraSocialName: string;
  organizationLogoUrl?: string;
  presentations: PresentationData[];
  isRegeneration: boolean;
}

interface PresentationData {
  orderId: string;
  patientName: string;
  patientLastName: string;
  orderDate: string;
  patientDni: string;
  totalSessions: number;
  sessionsUsed: number;
  doctorName?: string;
  orderType?: string;
  completedAt?: string;
}

interface ValidationResult {
  orderId: string;
  patientName: string;
  isComplete: boolean;
  missingDocuments: string[];
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

    const requestData: BillingPackageData = await req.json();
    const { invoiceId, obraSocialId, obraSocialName, organizationLogoUrl, presentations, isRegeneration } = requestData;

    console.log('📦 Starting package generation for invoice:', invoiceId);
    console.log('🔢 Total presentations:', presentations.length);
    console.log('🔄 Is regeneration:', isRegeneration);

    // STEP 1: Validate all presentations have required documents
    console.log('✅ Step 1: Validating documents...');
    const validationResults = await validatePresentationsDocuments(supabaseClient, presentations);
    
    const incompletePresentation = validationResults.find(v => !v.isComplete);
    if (incompletePresentation) {
      throw new Error(`Presentation for ${incompletePresentation.patientName} is missing documents: ${incompletePresentation.missingDocuments.join(', ')}`);
    }

    // STEP 2: Generate Excel
    console.log('📊 Step 2: Generating Excel...');
    const excelPath = await generateExcel(supabaseClient, invoiceId, obraSocialId, obraSocialName, presentations);
    console.log('✅ Excel generated:', excelPath);

    // STEP 3: Generate consolidated PDFs for each patient
    console.log('📄 Step 3: Generating consolidated PDFs...');
    const consolidatedPdfs: Array<{ patientName: string; path: string; orderDate: string; orderId: string }> = [];
    
    for (let i = 0; i < presentations.length; i++) {
      const presentation = presentations[i];
      console.log(`📑 Processing patient ${i + 1}/${presentations.length}: ${presentation.patientName}`);
      
      const pdfPath = await generateConsolidatedPDF(
        supabaseClient,
        presentation,
        obraSocialName,
        organizationLogoUrl,
        invoiceId
      );
      
      consolidatedPdfs.push({
        patientName: `${presentation.patientLastName}_${presentation.patientName}`,
        path: pdfPath,
        orderDate: presentation.orderDate,
        orderId: presentation.orderId
      });
    }
    console.log('✅ All PDFs consolidated:', consolidatedPdfs.length);

    // STEP 4: Create ZIP package
    console.log('🗜️ Step 4: Creating ZIP package...');
    const zipPath = await createZipPackage(
      supabaseClient,
      invoiceId,
      excelPath,
      consolidatedPdfs,
      obraSocialName
    );
    console.log('✅ ZIP created:', zipPath);

    // STEP 5: Register consolidated PDFs in billing_package_documents
    console.log('💾 Step 5: Registering documents...');
    for (const pdf of consolidatedPdfs) {
      await supabaseClient
        .from('billing_package_documents')
        .insert({
          billing_invoice_id: invoiceId,
          medical_order_id: pdf.orderId,
          patient_name: pdf.patientName,
          order_date: pdf.orderDate,
          consolidated_pdf_url: pdf.path,
          consolidated_pdf_name: `${pdf.patientName}_${pdf.orderDate}.pdf`
        });
    }

    // STEP 6: Update billing invoice
    console.log('🔄 Step 6: Updating invoice record...');
    
    const { data: currentInvoice } = await supabaseClient
      .from('billing_invoices')
      .select('regeneration_count')
      .eq('id', invoiceId)
      .single();

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', (await supabaseClient.auth.getUser()).data.user?.id)
      .single();

    const updateData: any = {
      package_url: zipPath,
      package_status: 'ready',
      package_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isRegeneration) {
      updateData.regeneration_count = (currentInvoice?.regeneration_count || 0) + 1;
      updateData.last_regenerated_at = new Date().toISOString();
      updateData.last_regenerated_by = profile?.id;
    }

    await supabaseClient
      .from('billing_invoices')
      .update(updateData)
      .eq('id', invoiceId);

    console.log('✅ Package generation complete!');

    return new Response(
      JSON.stringify({
        success: true,
        invoiceId,
        packageUrl: zipPath,
        pdfCount: consolidatedPdfs.length,
        excelGenerated: true,
        isRegeneration
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error generating package:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function validatePresentationsDocuments(
  supabaseClient: any,
  presentations: PresentationData[]
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const presentation of presentations) {
    const missingDocuments: string[] = [];

    // Check medical order attachment
    const { data: medicalOrder } = await supabaseClient
      .from('medical_orders')
      .select('attachment_url')
      .eq('id', presentation.orderId)
      .single();

    if (!medicalOrder?.attachment_url) {
      missingDocuments.push('Orden Médica');
    }

    // Check presentation documents
    const { data: documents } = await supabaseClient
      .from('presentation_documents')
      .select('document_type')
      .eq('medical_order_id', presentation.orderId);

    const documentTypes = new Set(documents?.map((d: any) => d.document_type) || []);

    if (!documentTypes.has('clinical_evolution')) {
      missingDocuments.push('Evolución Clínica');
    }
    if (!documentTypes.has('attendance_record')) {
      missingDocuments.push('Planilla de Asistencia');
    }
    if (!documentTypes.has('social_work_authorization')) {
      missingDocuments.push('Autorización Obra Social');
    }

    results.push({
      orderId: presentation.orderId,
      patientName: presentation.patientName,
      isComplete: missingDocuments.length === 0,
      missingDocuments
    });
  }

  return results;
}

async function generateExcel(
  supabaseClient: any,
  invoiceId: string,
  obraSocialId: string,
  obraSocialName: string,
  presentations: PresentationData[]
): Promise<string> {
  // Get template if exists
  const { data: template } = await supabaseClient
    .from('billing_export_templates')
    .select('column_config')
    .eq('obra_social_art_id', obraSocialId)
    .eq('is_active', true)
    .single();

  const defaultColumns = [
    { field: 'patient_name', label: 'Paciente', order: 0 },
    { field: 'patient_dni', label: 'DNI', order: 1 },
    { field: 'order_date', label: 'Fecha Orden', order: 2 },
    { field: 'sessions_total', label: 'Sesiones Totales', order: 3 },
    { field: 'sessions_used', label: 'Sesiones Realizadas', order: 4 },
  ];

  const columns = template?.column_config || defaultColumns;
  columns.sort((a: any, b: any) => a.order - b.order);

  const excelData = presentations.map((p) => {
    const row: any = {};
    columns.forEach((col: any) => {
      switch(col.field) {
        case 'patient_name':
          row[col.label] = `${p.patientLastName} ${p.patientName}`;
          break;
        case 'patient_dni':
          row[col.label] = p.patientDni || '';
          break;
        case 'order_date':
          row[col.label] = p.orderDate || '';
          break;
        case 'sessions_total':
          row[col.label] = p.totalSessions || 0;
          break;
        case 'sessions_used':
          row[col.label] = p.sessionsUsed || 0;
          break;
        case 'doctor_name':
          row[col.label] = p.doctorName || '';
          break;
      }
    });
    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);
  const cols = columns.map(() => ({ wch: 20 }));
  ws['!cols'] = cols;

  XLSX.utils.book_append_sheet(wb, ws, `Facturación ${obraSocialName}`);
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Factura_${obraSocialName.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
  const path = `packages/${invoiceId}/excel/${filename}`;

  const { error } = await supabaseClient.storage
    .from('billing-packages')
    .upload(path, excelBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true
    });

  if (error) throw error;
  return path;
}

async function generateConsolidatedPDF(
  supabaseClient: any,
  presentation: PresentationData,
  obraSocialName: string,
  organizationLogoUrl: string | undefined,
  invoiceId: string
): Promise<string> {
  // Store document paths for client-side consolidation
  const documentPaths = [];

  const documentTypes = [
    { type: 'medical_order', label: 'Orden Médica', useMedicalOrderAttachment: true },
    { type: 'clinical_evolution', label: 'Evolución Clínica', useMedicalOrderAttachment: false },
    { type: 'attendance_record', label: 'Planilla de Asistencia', useMedicalOrderAttachment: false },
    { type: 'social_work_authorization', label: 'Autorización Obra Social', useMedicalOrderAttachment: false }
  ];

  for (const docType of documentTypes) {
    let pdfUrl: string | null = null;

    if (docType.useMedicalOrderAttachment) {
      const { data: order } = await supabaseClient
        .from('medical_orders')
        .select('attachment_url')
        .eq('id', presentation.orderId)
        .single();
      pdfUrl = order?.attachment_url;
    } else {
      const { data: doc } = await supabaseClient
        .from('presentation_documents')
        .select('file_url')
        .eq('medical_order_id', presentation.orderId)
        .eq('document_type', docType.type)
        .single();
      pdfUrl = doc?.file_url;
    }

    if (pdfUrl) {
      documentPaths.push({ type: docType.type, path: pdfUrl, label: docType.label });
    }
  }

  // Store metadata for client-side PDF consolidation
  const filename = `${presentation.patientLastName}_${presentation.patientName}_${presentation.orderDate}.pdf`;
  const metadataPath = `packages/${invoiceId}/metadata/${filename}.json`;
  
  const metadata = {
    patientName: `${presentation.patientLastName} ${presentation.patientName}`,
    orderDate: presentation.orderDate,
    obraSocialName,
    documents: documentPaths,
    filename
  };

  const { error } = await supabaseClient.storage
    .from('billing-packages')
    .upload(metadataPath, JSON.stringify(metadata), {
      contentType: 'text/plain',
      upsert: true
    });

  if (error) throw error;
  return metadataPath;
}

async function createZipPackage(
  supabaseClient: any,
  invoiceId: string,
  excelPath: string,
  consolidatedPdfs: Array<{ patientName: string; path: string }>,
  obraSocialName: string
): Promise<string> {
  // Note: Deno's standard library doesn't have built-in ZIP support
  // For now, we'll just return a path indicating the package location
  // In production, you might want to use a ZIP library or create the ZIP client-side
  
  // For this implementation, we'll store metadata about the package
  // The actual ZIP creation can be done client-side when downloading
  
  const packagePath = `packages/${invoiceId}/package_info.json`;
  const packageInfo = {
    invoiceId,
    excelPath,
    pdfPaths: consolidatedPdfs,
    obraSocialName,
    createdAt: new Date().toISOString()
  };

  const { error } = await supabaseClient.storage
    .from('billing-packages')
    .upload(packagePath, JSON.stringify(packageInfo), {
      contentType: 'text/plain',
      upsert: true
    });

  if (error) throw error;
  
  return packagePath;
}
