import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadObrasSociales();
  }, []);

  const loadObrasSociales = async () => {
    try {
      const { data, error } = await supabase
        .from("obras_sociales_art")
        .select("*")
        .eq("is_active", true)
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

      // Mark medical orders as sent to obra social
      const { error: updateError } = await supabase
        .from("medical_orders")
        .update({ enviado_a_os: true })
        .in("id", data.selectedPresentations);

      if (updateError) throw updateError;

      return invoice;
    } catch (error) {
      console.error("Error creating billing invoice:", error);
      throw error;
    }
  };

  const generateExcelFile = async (invoiceId: string) => {
    try {
      // TODO: Implement Excel generation logic
      // This would involve:
      // 1. Getting the export template for the obra social
      // 2. Generating Excel file with configured columns
      // 3. Uploading to Supabase storage
      // 4. Updating invoice record with file URL
      
      console.log("Generating Excel file for invoice:", invoiceId);
      
      // Placeholder return
      return { fileUrl: "", fileName: "" };
    } catch (error) {
      console.error("Error generating Excel file:", error);
      throw error;
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
      // TODO: Implement file download logic from Supabase storage
      console.log("Downloading file for invoice:", invoiceId, fileName);
    } catch (error) {
      console.error("Error downloading invoice file:", error);
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

  return {
    obrasSociales,
    loading,
    getCompletedPresentations,
    createBillingInvoice,
    generateExcelFile,
    getBillingHistory,
    downloadInvoiceFile,
    getExportTemplates,
    createExportTemplate,
    updateExportTemplate,
    deleteExportTemplate,
  };
}