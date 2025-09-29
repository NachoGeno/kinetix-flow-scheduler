import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as XLSX from 'https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

/**
 * Resuelve una storage key desde diferentes formatos de URL
 * Maneja:
 * - URLs completas (https://...)
 * - Rutas relativas (medical-documents/...)
 * - Rutas con /object/public/ o /object/
 */
function resolveStorageKey(url: string): string {
  if (!url) return '';
  
  // Si ya es una ruta relativa, devolverla
  if (!url.includes('://') && !url.startsWith('http')) {
    return url;
  }
  
  // Extraer el path después de /object/public/ o /object/
  const patterns = [
    /\/object\/public\/[^\/]+\/(.*)/,
    /\/object\/[^\/]+\/(.*)/,
    /\/storage\/v1\/object\/public\/[^\/]+\/(.*)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return url;
}

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
    const { invoiceId, obraSocialId, obraSocialName, organizationLogoUrl, isRegeneration } = requestData;

    console.log('📦 Starting package generation for invoice:', invoiceId);
    console.log('🔄 Is regeneration:', isRegeneration);

    // STEP 0: Fetch presentations from database (source of truth)
    console.log('🔍 Step 0: Fetching presentations from database...');
    
    // Paso 1: Obtener los IDs de las órdenes médicas desde billing_invoice_items
    const { data: invoiceItems, error: itemsError } = await supabaseClient
      .from('billing_invoice_items')
      .select('medical_order_id')
      .eq('billing_invoice_id', invoiceId);

    if (itemsError) {
      console.error('❌ Error fetching invoice items:', itemsError);
      throw new Error(`Error fetching invoice items: ${itemsError.message}`);
    }

    if (!invoiceItems || invoiceItems.length === 0) {
      console.error('❌ No invoice items found for invoice:', invoiceId);
      throw new Error('No se pueden generar paquetes sin presentaciones');
    }

    // Extraer array de IDs
    const medicalOrderIds = invoiceItems.map((item: any) => item.medical_order_id);
    console.log(`📋 Found ${medicalOrderIds.length} orders in invoice:`, medicalOrderIds);

    // Paso 2: Obtener las medical_orders con sus relaciones usando los IDs
    const { data: orders, error: ordersError } = await supabaseClient
      .from('medical_orders')
      .select(`
        id,
        order_date,
        doctor_name,
        total_sessions,
        sessions_used,
        patient_id,
        patients!inner (
          id,
          profile_id,
          profiles!inner (
            first_name,
            last_name,
            dni
          )
        )
      `)
      .in('id', medicalOrderIds);

    if (ordersError) {
      console.error('❌ Error fetching medical orders:', ordersError);
      throw new Error(`Error fetching medical orders: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      console.error('❌ No medical orders found for IDs:', medicalOrderIds);
      throw new Error('No se encontraron órdenes médicas válidas');
    }

    console.log(`✅ Found ${orders.length} medical orders with patient data`);

    // Paso 3: Transformar a formato presentations
    const presentations: PresentationData[] = orders.map((order: any) => {
      try {
        const patient = order.patients;
        const profile = patient.profiles;
        
        if (!patient || !profile) {
          console.error('❌ Missing patient or profile data for order:', order.id);
          throw new Error(`Missing patient data for order ${order.id}`);
        }
        
        return {
          orderId: order.id,
          patientName: profile.first_name,
          patientLastName: profile.last_name,
          patientDni: profile.dni,
          orderDate: order.order_date,
          doctorName: order.doctor_name,
          totalSessions: order.total_sessions,
          sessionsUsed: order.sessions_used
        };
      } catch (mappingError) {
        console.error('❌ Error mapping order:', order.id, mappingError);
        throw mappingError;
      }
    });

    console.log('✅ Loaded presentations from database:', presentations.length);

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

    // STEP 6: Mark medical orders as sent (ONLY after successful package generation)
    console.log('✅ Step 6: Marking orders as sent to OS...');
    const orderIds = presentations.map(p => p.orderId);
    await supabaseClient
      .from('medical_orders')
      .update({ enviado_a_os: true })
      .in('id', orderIds);

    // STEP 7: Update billing invoice with ZIP path
    console.log('🔄 Step 7: Updating invoice record...');
    
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
      package_url: zipPath, // Now points to actual ZIP file
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
        error: (error as Error).message 
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

    // Check medical order attachment (verificar existencia física)
    const { data: medicalOrder } = await supabaseClient
      .from('medical_orders')
      .select('attachment_url')
      .eq('id', presentation.orderId)
      .single();

    if (!medicalOrder?.attachment_url) {
      missingDocuments.push('Orden Médica (no registrada)');
    } else {
      // Verificar que el archivo existe en Storage
      const storageKey = resolveStorageKey(medicalOrder.attachment_url);
      const { data: fileCheck, error: checkError } = await supabaseClient.storage
        .from('medical-documents')
        .download(storageKey);
      
      if (checkError || !fileCheck) {
        console.error(`❌ Orden Médica no existe en Storage: ${storageKey}`, checkError);
        missingDocuments.push(`Orden Médica (archivo no encontrado en Storage: ${storageKey})`);
      }
    }

    // Check presentation documents (verificar existencia física)
    const { data: documents } = await supabaseClient
      .from('presentation_documents')
      .select('document_type, file_url')
      .eq('medical_order_id', presentation.orderId);

    const documentTypes = new Set(documents?.map((d: any) => d.document_type) || []);
    
    // Validar existencia física de cada documento
    const docTypesToCheck = [
      { type: 'clinical_evolution', label: 'Evolución Clínica' },
      { type: 'attendance_record', label: 'Planilla de Asistencia' },
      { type: 'social_work_authorization', label: 'Autorización Obra Social' }
    ];

    for (const docType of docTypesToCheck) {
      if (!documentTypes.has(docType.type)) {
        missingDocuments.push(`${docType.label} (no registrado)`);
      } else {
        // Encontrar el documento y verificar su existencia en Storage
        const doc = documents.find((d: any) => d.document_type === docType.type);
        if (doc?.file_url) {
          const storageKey = resolveStorageKey(doc.file_url);
          const { data: fileCheck, error: checkError } = await supabaseClient.storage
            .from('medical-documents')
            .download(storageKey);
          
          if (checkError || !fileCheck) {
            console.error(`❌ ${docType.label} no existe en Storage: ${storageKey}`, checkError);
            missingDocuments.push(`${docType.label} (archivo no encontrado en Storage: ${storageKey})`);
          }
        }
      }
    }

    results.push({
      orderId: presentation.orderId,
      patientName: `${presentation.patientName} ${presentation.patientLastName}`,
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

  const wb: any = { SheetNames: [], Sheets: {} };
  const ws = XLSX.utils.json_to_sheet(excelData);
  const cols = columns.map(() => ({ wch: 20 }));
  ws['!cols'] = cols;

  const sheetName = `Facturación ${obraSocialName}`;
  wb.SheetNames.push(sheetName);
  wb.Sheets[sheetName] = ws;
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = sanitizeFileName(`Factura_${obraSocialName}_${timestamp}.xlsx`);
  console.log(`📊 Excel filename sanitized: ${filename}`);
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
  invoiceId: string
): Promise<string> {
  console.log(`📄 Generating consolidated PDF for ${presentation.patientName}...`);
  
  const documentTypes = [
    { type: 'medical_order', useMedicalOrderAttachment: true },
    { type: 'clinical_evolution', useMedicalOrderAttachment: false },
    { type: 'attendance_record', useMedicalOrderAttachment: false },
    { type: 'social_work_authorization', useMedicalOrderAttachment: false }
  ];

  // Create merged PDF document
  const mergedPdf = await PDFDocument.create();
  let pagesAdded = 0;
  
  for (const docType of documentTypes) {
    try {
      let pdfUrl: string | null = null;
      let storageBucket = 'medical-documents';

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

      if (!pdfUrl) {
        const errorMsg = `Document ${docType.type} not found for order ${presentation.orderId}`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Resolver storage key para manejar diferentes formatos de URL
      const storageKey = resolveStorageKey(pdfUrl);

      // Download PDF from storage usando la key resuelta
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from(storageBucket)
        .download(storageKey);
      
      if (downloadError) {
        const errorMsg = `Failed to download ${docType.type} from Storage (${storageKey}): ${downloadError.message}`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      if (!fileData) {
        const errorMsg = `No data returned for ${docType.type} (${storageKey})`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Convert blob to array buffer
      const arrayBuffer = await fileData.arrayBuffer();
      
      // Load the PDF
      const pdf = await PDFDocument.load(arrayBuffer);
      
      // Copy all pages from this PDF to the merged PDF
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
        pagesAdded++;
      });
      
      console.log(`✅ Added ${docType.type} to consolidated PDF (${copiedPages.length} pages)`);
    } catch (error) {
      console.error(`❌ CRITICAL: Error processing ${docType.type}:`, error);
      throw error; // Propagar error para prevenir PDFs vacíos
    }
  }

  // VALIDACIÓN CRÍTICA: Prevenir PDFs vacíos
  if (pagesAdded === 0) {
    const errorMsg = `No pages added to consolidated PDF for ${presentation.patientName}. Cannot create empty PDF.`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log(`✅ Consolidated PDF has ${pagesAdded} pages total`);
  
  // Save the merged PDF
  const pdfBytes = await mergedPdf.save();
  
  // Upload consolidated PDF to storage
  const filename = sanitizeFileName(
    `${presentation.patientLastName}_${presentation.patientName}_${presentation.orderDate}.pdf`
  );
  console.log(`📄 PDF filename sanitized: ${filename}`);
  const consolidatedPath = `packages/${invoiceId}/pdfs/${filename}`;
  
  const { error: uploadError } = await supabaseClient.storage
    .from('billing-packages')
    .upload(consolidatedPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true
    });
  
  if (uploadError) {
    throw new Error(`Error uploading consolidated PDF: ${uploadError.message}`);
  }
  
  console.log(`✅ Consolidated PDF uploaded: ${consolidatedPath}`);
  return consolidatedPath;
}

async function createZipPackage(
  supabaseClient: any,
  invoiceId: string,
  excelPath: string,
  consolidatedPdfs: Array<{ patientName: string; path: string }>,
  obraSocialName: string
): Promise<string> {
  console.log(`📦 Creating ZIP package with Excel + ${consolidatedPdfs.length} PDFs...`);
  
  const zip = new JSZip();
  
  // Download and add Excel file to ZIP
  const { data: excelData, error: excelError } = await supabaseClient.storage
    .from('billing-packages')
    .download(excelPath);
  
  if (excelError) throw new Error(`Error downloading Excel: ${excelError.message}`);
  
  const excelBuffer = await excelData.arrayBuffer();
  const excelFileName = excelPath.split('/').pop() || 'factura.xlsx';
  zip.file(excelFileName, excelBuffer);
  console.log(`✅ Added Excel to ZIP`);
  
  // Create PDFs folder in ZIP
  const pdfsFolder = zip.folder('PDFs');
  
  // Download and add each PDF to ZIP
  for (const pdfRef of consolidatedPdfs) {
    try {
      const { data: pdfData, error: pdfError } = await supabaseClient.storage
        .from('billing-packages')
        .download(pdfRef.path);
      
      if (pdfError) {
        console.error(`Error downloading PDF ${pdfRef.patientName}:`, pdfError);
        continue;
      }
      
      const pdfBuffer = await pdfData.arrayBuffer();
      const pdfFileName = pdfRef.path.split('/').pop() || `${pdfRef.patientName}.pdf`;
      pdfsFolder?.file(pdfFileName, pdfBuffer);
      console.log(`✅ Added ${pdfFileName} to ZIP`);
    } catch (error) {
      console.error(`Error processing PDF ${pdfRef.patientName}:`, error);
    }
  }
  
  // Generate ZIP file
  const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
  
  // Upload ZIP to storage
  const today = new Date().toISOString().split('T')[0];
  const zipFileName = sanitizeFileName(`Factura_${obraSocialName}_${today}.zip`);
  console.log(`📦 ZIP filename sanitized: ${zipFileName}`);
  const zipPath = `packages/${invoiceId}/${zipFileName}`;
  
  const { error: uploadError } = await supabaseClient.storage
    .from('billing-packages')
    .upload(zipPath, zipBuffer, {
      contentType: 'application/zip',
      upsert: true
    });
  
  if (uploadError) throw new Error(`Error uploading ZIP: ${uploadError.message}`);
  
  console.log(`✅ ZIP package uploaded: ${zipPath}`);
  return zipPath;
}
