import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

interface CompletedPresentation {
  id: string;
  patient_name: string;
  patient_dni: string;
  order_description: string;
  total_sessions: number;
  sessions_completed: number;
  completed_at: string;
  professional_name: string;
  obra_social_name: string;
}

interface BillingInvoiceData {
  obraSocialId: string;
  invoiceNumber: string;
  periodStart: Date;
  periodEnd: Date;
  selectedPresentations: string[];
}

export function useBilling() {
  const [obrasSociales, setObrasSociales] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useAuth();
  const { currentOrgId } = useOrganizationContext();

  useEffect(() => {
    if (currentOrgId) {
      loadObrasSociales();
    }
  }, [currentOrgId]);

  const loadObrasSociales = async () => {
    if (!currentOrgId) return;
    
    try {
      const { data, error } = await supabase
        .from("obras_sociales_art")
        .select("*")
        .eq("is_active", true)
        .eq("organization_id", currentOrgId)
        .order("nombre");

      if (error) throw error;
      setObrasSociales(data || []);
    } catch (error) {
      console.error("Error loading obras sociales:", error);
      throw error;
    }
  };

  const getCompletedPresentations = async ({
    obraSocialId,
    periodStart,
    periodEnd,
  }: {
    obraSocialId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<CompletedPresentation[]> => {
    if (!currentOrgId) throw new Error("Organization context not available");
    
    try {
      const { data, error } = await supabase
        .from("medical_orders")
        .select(`
          id,
          description,
          total_sessions,
          sessions_used,
          completed_at,
          enviado_a_os,
          patients:patient_id (
            id,
            profiles:profile_id (
              first_name,
              last_name,
              dni
            ),
            obra_social_art_id
          ),
          doctors:doctor_id (
            profiles:profile_id (
              first_name,
              last_name
            )
          )
        `)
        .eq("completed", true)
        .eq("enviado_a_os", false)
        .eq("organization_id", currentOrgId)
        .gte("completed_at", periodStart.toISOString())
        .lte("completed_at", periodEnd.toISOString());

      if (error) throw error;

      // Filter by obra social and format data
      const presentations = (data || [])
        .filter((order: any) => 
          order.patients?.obra_social_art_id === obraSocialId
        )
        .map((order: any) => ({
          id: order.id,
          patient_name: `${order.patients?.profiles?.first_name} ${order.patients?.profiles?.last_name}`,
          patient_dni: order.patients?.profiles?.dni || "",
          order_description: order.description,
          total_sessions: order.total_sessions,
          sessions_completed: order.sessions_used,
          completed_at: order.completed_at,
          professional_name: order.doctors?.profiles ? 
            `${order.doctors.profiles.first_name} ${order.doctors.profiles.last_name}` : 
            "Sin asignar",
          obra_social_name: "", // Will be filled by obra social lookup
        }));

      return presentations;
    } catch (error) {
      console.error("Error getting completed presentations:", error);
      throw error;
    }
  };

  const createBillingInvoice = async (data: BillingInvoiceData) => {
    try {
      // Get current user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) throw new Error("User profile not found");

      // Create billing invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("billing_invoices")
        .insert({
          obra_social_art_id: data.obraSocialId,
          invoice_number: data.invoiceNumber,
          period_start: data.periodStart.toISOString().split('T')[0],
          period_end: data.periodEnd.toISOString().split('T')[0],
          total_presentations: data.selectedPresentations.length,
          created_by: profile.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create billing invoice items
      const invoiceItems = data.selectedPresentations.map(presentationId => ({
        billing_invoice_id: invoice.id,
        medical_order_id: presentationId,
      }));

      const { error: itemsError } = await supabase
        .from("billing_invoice_items")
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      // DON'T mark orders as sent yet - will be done after package generation succeeds
      
      return invoice;
    } catch (error) {
      console.error("Error creating billing invoice:", error);
      throw error;
    }
  };

  const generateExcelFile = async (invoiceId: string) => {
    try {
      setIsGenerating(true);
      
      // Get invoice details separately to avoid complex joins
      const { data: invoice, error: invoiceError } = await supabase
        .from('billing_invoices')
        .select(`
          *,
          obras_sociales_art!inner(nombre)
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Get invoice items separately
      const { data: invoiceItems, error: itemsError } = await supabase
        .from('billing_invoice_items')
        .select(`
          medical_order_id,
          medical_orders!inner(
            id,
            patient_id,
            order_date,
            total_sessions,
            sessions_used,
            completed_at,
            order_type,
            doctor_name,
            patients!inner(
              profile_id,
              profiles!inner(first_name, last_name, dni)
            )
          )
        `)
        .eq('billing_invoice_id', invoiceId);

      if (itemsError) throw itemsError;

      // Get export template for this obra social
      const { data: template } = await supabase
        .from('billing_export_templates')
        .select('column_config')
        .eq('obra_social_art_id', invoice.obra_social_art_id)
        .eq('is_active', true)
        .single();

      // Transform data for Excel generation
      const presentations = invoiceItems.map((item: any) => ({
        order_id: item.medical_orders.id,
        patient_name: `${item.medical_orders.patients.profiles.first_name} ${item.medical_orders.patients.profiles.last_name}`,
        patient_dni: item.medical_orders.patients.profiles.dni,
        order_date: item.medical_orders.order_date,
        total_sessions: item.medical_orders.total_sessions,
        sessions_used: item.medical_orders.sessions_used,
        completed_at: item.medical_orders.completed_at,
        order_type: item.medical_orders.order_type,
        doctor_name: item.medical_orders.doctor_name
      }));

      // Call edge function to generate Excel
      const { data: result, error: functionError } = await supabase.functions.invoke('generate-billing-excel', {
        body: {
          invoiceId,
          obraSocialId: invoice.obra_social_art_id,
          presentations,
          columnConfig: template?.column_config || []
        }
      });

      if (functionError) throw functionError;
      if (!result.success) throw new Error(result.error);

      console.log('Excel generated successfully:', result.filename);
      return result;
      
    } catch (error) {
      console.error('Error generating Excel:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const getBillingHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get related data separately to avoid complex joins
      const invoicesWithDetails = await Promise.all(
        (data || []).map(async (invoice) => {
          // Get obra social info
          const { data: obraSocial } = await supabase
            .from("obras_sociales_art")
            .select("nombre, tipo")
            .eq("id", invoice.obra_social_art_id)
            .single();

          // Get creator info
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", invoice.created_by)
            .single();

          return {
            ...invoice,
            obra_social_name: obraSocial?.nombre || "Desconocido",
            obra_social_tipo: obraSocial?.tipo || "Desconocido",
            created_by_name: profile ? 
              `${profile.first_name} ${profile.last_name}` : 
              "Usuario desconocido",
          };
        })
      );

      return invoicesWithDetails;
    } catch (error) {
      console.error("Error getting billing history:", error);
      throw error;
    }
  };

  const downloadInvoiceFile = async (invoiceId: string, fileName: string) => {
    try {
      // Get the file path from the invoice
      const { data: invoice, error } = await supabase
        .from('billing_invoices')
        .select('file_url')
        .eq('id', invoiceId)
        .single();

      if (error) throw error;
      if (!invoice.file_url) throw new Error('No file available for download');

      // Download from Supabase Storage
      const { data, error: downloadError } = await supabase.storage
        .from('billing-files')
        .download(invoice.file_url);

      if (downloadError) throw downloadError;

      // Create download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('File downloaded successfully:', fileName);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  };

  const getExportTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("billing_export_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get related obra social data separately
      const templatesWithDetails = await Promise.all(
        (data || []).map(async (template) => {
          const { data: obraSocial } = await supabase
            .from("obras_sociales_art")
            .select("nombre, tipo")
            .eq("id", template.obra_social_art_id)
            .single();

          return {
            ...template,
            obra_social_name: obraSocial?.nombre || "Desconocido",
            obra_social_tipo: obraSocial?.tipo || "Desconocido",
          };
        })
      );

      return templatesWithDetails;
    } catch (error) {
      console.error("Error getting export templates:", error);
      throw error;
    }
  };

  const createExportTemplate = async (templateData: any) => {
    try {
      const { data, error } = await supabase
        .from("billing_export_templates")
        .insert({
          obra_social_art_id: templateData.obraSocialId,
          template_name: templateData.templateName,
          column_config: templateData.columnConfig,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating export template:", error);
      throw error;
    }
  };

  const updateExportTemplate = async (templateId: string, templateData: any) => {
    try {
      const { data, error } = await supabase
        .from("billing_export_templates")
        .update({
          obra_social_art_id: templateData.obraSocialId,
          template_name: templateData.templateName,
          column_config: templateData.columnConfig,
        })
        .eq("id", templateId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error updating export template:", error);
      throw error;
    }
  };

  const deleteExportTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from("billing_export_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting export template:", error);
      throw error;
    }
  };

  const validatePresentationDocuments = async (orderIds: string[]) => {
    try {
      const validationResults = [];

      for (const orderId of orderIds) {
        const missingDocuments: string[] = [];
        const documentsStatus = {
          medical_order: false,
          clinical_evolution: false,
          attendance_record: false,
          social_work_authorization: false
        };

        // Check medical order attachment
        const { data: medicalOrder } = await supabase
          .from('medical_orders')
          .select('attachment_url, patients:patient_id(profiles:profile_id(first_name, last_name))')
          .eq('id', orderId)
          .single();

        documentsStatus.medical_order = !!medicalOrder?.attachment_url;
        if (!medicalOrder?.attachment_url) {
          missingDocuments.push('medical_order');
        }

        // Check presentation documents
        const { data: documents } = await supabase
          .from('presentation_documents')
          .select('document_type')
          .eq('medical_order_id', orderId);

        const documentTypes = new Set(documents?.map((d: any) => d.document_type) || []);

        documentsStatus.clinical_evolution = documentTypes.has('clinical_evolution');
        documentsStatus.attendance_record = documentTypes.has('attendance_record');
        documentsStatus.social_work_authorization = documentTypes.has('social_work_authorization');

        if (!documentsStatus.clinical_evolution) missingDocuments.push('clinical_evolution');
        if (!documentsStatus.attendance_record) missingDocuments.push('attendance_record');
        if (!documentsStatus.social_work_authorization) missingDocuments.push('social_work_authorization');

        const patientName = medicalOrder?.patients?.profiles 
          ? `${medicalOrder.patients.profiles.first_name} ${medicalOrder.patients.profiles.last_name}`
          : 'Desconocido';

        validationResults.push({
          orderId,
          patientName,
          isComplete: missingDocuments.length === 0,
          missingDocuments,
          documentsStatus
        });
      }

      return validationResults;
    } catch (error) {
      console.error('Error validating documents:', error);
      throw error;
    }
  };

  const generateBillingPackage = async (invoiceId: string, isRegeneration: boolean = false) => {
    try {
      setIsGenerating(true);

      // Get invoice and presentations data
      const { data: invoice } = await supabase
        .from('billing_invoices')
        .select('obra_social_art_id')
        .eq('id', invoiceId)
        .single();
      
      const { data: obraSocial } = await supabase
        .from('obras_sociales_art')
        .select('nombre')
        .eq('id', invoice?.obra_social_art_id)
        .single();

      const { data: invoiceItems } = await supabase
        .from('billing_invoice_items')
        .select(`
          medical_order_id,
          medical_orders!inner(
            id,
            order_date,
            total_sessions,
            sessions_used,
            doctor_name,
            patients!inner(
              profiles!inner(first_name, last_name, dni)
            )
          )
        `)
        .eq('billing_invoice_id', invoiceId);

      const presentations = invoiceItems?.map((item: any) => ({
        orderId: item.medical_orders.id,
        patientName: item.medical_orders.patients.profiles.first_name,
        patientLastName: item.medical_orders.patients.profiles.last_name,
        patientDni: item.medical_orders.patients.profiles.dni,
        orderDate: item.medical_orders.order_date,
        totalSessions: item.medical_orders.total_sessions,
        sessionsUsed: item.medical_orders.sessions_used,
        doctorName: item.medical_orders.doctor_name
      })) || [];

      // Get organization info
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, organizations!inner(logo_url)')
        .eq('user_id', user?.id)
        .single();

      const { data: result, error } = await supabase.functions.invoke('generate-billing-package', {
        body: {
          invoiceId,
          obraSocialId: invoice?.obra_social_art_id,
          obraSocialName: obraSocial?.nombre,
          organizationLogoUrl: profile?.organizations?.logo_url,
          presentations,
          isRegeneration
        }
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error);

      console.log('Package generated successfully:', result);
      return result;

    } catch (error) {
      console.error('Error generating package:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadFullPackage = async (invoiceId: string, fileName: string) => {
    try {
      const { data: invoice } = await supabase
        .from('billing_invoices')
        .select(`
          package_url
        `)
        .eq('id', invoiceId)
        .single();

      if (!invoice?.package_url) throw new Error('No package available');

      // Prefer downloading a generated ZIP if present
      const { data: rootList } = await supabase.storage
        .from('billing-packages')
        .list(invoice.package_url);

      const zipEntry = rootList?.find((f: any) => f.name?.toLowerCase?.().endsWith('.zip'));
      if (zipEntry) {
        const zipPath = `${invoice.package_url}/${zipEntry.name}`;
        const { data: zipData } = await supabase.storage
          .from('billing-packages')
          .download(zipPath);
        if (zipData) {
          const url = window.URL.createObjectURL(zipData);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName || zipEntry.name;
          a.click();
          window.URL.revokeObjectURL(url);
          return;
        }
      }

      // Fallback: download Excel file and PDFs individually
      const files: Array<{ name: string; data: Blob }> = [];

      // Find Excel inside the excel folder
      const excelDir = `${invoice.package_url}/excel`;
      const { data: excelList } = await supabase.storage
        .from('billing-packages')
        .list(excelDir);
      const excelFile = excelList?.find((f: any) => f.name?.toLowerCase?.().endsWith('.xlsx'));
      if (excelFile) {
        const excelPath = `${excelDir}/${excelFile.name}`;
        const { data: excelData } = await supabase.storage
          .from('billing-packages')
          .download(excelPath);
        if (excelData) files.push({ name: excelFile.name, data: excelData });
      }

      // PDFs from DB records
      const { data: documents } = await supabase
        .from('billing_package_documents')
        .select('*')
        .eq('billing_invoice_id', invoiceId)
        .order('patient_name');
      if (documents) {
        for (const doc of documents as any[]) {
          const { data: pdfData } = await supabase.storage
            .from('billing-packages')
            .download(doc.consolidated_pdf_url);
          if (pdfData) files.push({ name: doc.consolidated_pdf_name, data: pdfData });
        }
      }

      if (files.length > 0) {
        const first = files[0];
        const url = window.URL.createObjectURL(first.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = first.name;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('No downloadable files found');
      }

    } catch (error) {
      console.error('Error downloading package:', error);
      throw error;
    }
  };

  const getPackageDocuments = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase
        .from('billing_package_documents')
        .select('*')
        .eq('billing_invoice_id', invoiceId)
        .order('patient_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting package documents:', error);
      throw error;
    }
  };

  const markInvoiceAsSent = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('billing_invoices')
        .update({ package_status: 'sent' })
        .eq('id', invoiceId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking invoice as sent:', error);
      throw error;
    }
  };

  const downloadExcelOnly = async (invoiceId: string) => {
    try {
      const { data: invoice } = await supabase
        .from('billing_invoices')
        .select(`
          package_url
        `)
        .eq('id', invoiceId)
        .single();

      if (!invoice?.package_url) throw new Error('No package available');

      const excelDir = `${invoice.package_url}/excel`;
      // List files in the excel directory to find the generated Excel name
      const { data: entries, error: listError } = await supabase.storage
        .from('billing-packages')
        .list(excelDir);

      if (listError) throw listError;
      const excelEntry = entries?.find((e: any) => e.name?.toLowerCase?.().endsWith('.xlsx'));

      if (!excelEntry) throw new Error('Excel file not found');

      const excelPath = `${excelDir}/${excelEntry.name}`;
      const { data: excelData, error: downloadError } = await supabase.storage
        .from('billing-packages')
        .download(excelPath);

      if (downloadError || !excelData) {
        throw new Error('Excel file not found');
      }

      const url = window.URL.createObjectURL(excelData);
      const a = document.createElement('a');
      a.href = url;
      a.download = excelEntry.name;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading Excel:', error);
      throw error;
    }
  };

  const cancelBillingInvoice = async (invoiceId: string) => {
    try {
      // Get invoice items to get order IDs
      const { data: items } = await supabase
        .from('billing_invoice_items')
        .select('medical_order_id')
        .eq('billing_invoice_id', invoiceId);

      // Update invoice status to cancelled
      const { error: invoiceError } = await supabase
        .from('billing_invoices')
        .update({ 
          status: 'cancelled', 
          package_status: 'error' 
        })
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      // Revert enviado_a_os flag for associated orders
      if (items && items.length > 0) {
        const orderIds = items.map(item => item.medical_order_id);
        const { error: ordersError } = await supabase
          .from('medical_orders')
          .update({ enviado_a_os: false })
          .in('id', orderIds);

        if (ordersError) throw ordersError;
      }

      console.log('Invoice cancelled and orders reverted successfully');
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      throw error;
    }
  };

  return {
    obrasSociales,
    invoices,
    templates,
    loading,
    isGenerating,
    getCompletedPresentations,
    createBillingInvoice,
    generateExcelFile,
    getBillingHistory,
    downloadInvoiceFile,
    getExportTemplates,
    createExportTemplate,
    updateExportTemplate,
    deleteExportTemplate,
    // New functions for package management
    validatePresentationDocuments,
    generateBillingPackage,
    downloadFullPackage,
    getPackageDocuments,
    markInvoiceAsSent,
    downloadExcelOnly,
    cancelBillingInvoice,
  };
}