import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Upload,
  Download,
  Send,
  Filter,
  Search,
  Eye,
  Calendar,
  User,
  Building2,
  Clock,
  FileDown,
  AlertCircle,
  Edit2
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface PresentationOrder {
  id: string;
  description: string;
  total_sessions: number;
  sessions_used: number;
  completed: boolean;
  presentation_status: string;
  patient: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
      dni: string | null;
    };
  };
  obra_social: {
    id: string;
    nombre: string;
    tipo: string;
  };
  doctor_name: string | null;
  created_at: string;
  attachment_url: string | null;
  attachment_name: string | null;
  documents: {
    medical_order: DocumentInfo | null;
    clinical_evolution: DocumentInfo | null;
    attendance_record: DocumentInfo | null;
    social_work_authorization: DocumentInfo | null;
  };
  sessions_completed: boolean;
}

interface DocumentInfo {
  id: string;
  file_url: string;
  file_name: string;
  uploaded_by: string;
  uploaded_at: string;
  uploader_name: string;
}

interface FilterState {
  obra_social_id: string;
  professional: string;
  date_from: string;
  date_to: string;
  status: 'all' | 'complete' | 'incomplete' | 'submitted';
  search_term: string;
}

export default function Presentaciones() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<FilterState>({
    obra_social_id: '',
    professional: '',
    date_from: '',
    date_to: '',
    status: 'all',
    search_term: ''
  });
  const [selectedOrder, setSelectedOrder] = useState<PresentationOrder | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'clinical_evolution' | 'attendance_record' | 'social_work_authorization' | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Fetch obras sociales
  const { data: obrasSociales } = useQuery({
    queryKey: ["obras-sociales-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras_sociales_art")
        .select("id, nombre, tipo")
        .eq("is_active", true)
        .order("nombre");
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch presentations data
  const { data: presentations, refetch } = useQuery({
    queryKey: ["presentations", filters],
    queryFn: async () => {
      console.log("🔍 Cargando presentaciones con filtros:", filters);

      // Base query for medical orders ready for presentation
      let query = supabase
        .from("medical_orders")
        .select(`
          id,
          description,
          total_sessions,
          sessions_used,
          completed,
          presentation_status,
          doctor_name,
          created_at,
          attachment_url,
          attachment_name,
          patient:patients!inner(
            id,
            profile:profiles(first_name, last_name, dni)
          ),
          obra_social:obras_sociales_art!inner(
            id,
            nombre,
            tipo
          )
        `)
        .not("obra_social_art_id", "is", null) // Must have obra social
        .not("patient_id", "is", null); // Must have patient

      // Apply filters
      if (filters.obra_social_id) {
        query = query.eq("obra_social_art_id", filters.obra_social_id);
      }

      if (filters.date_from) {
        query = query.gte("created_at", filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte("created_at", filters.date_to + "T23:59:59");
      }

      const { data: orders, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching orders:", error);
        throw error;
      }

      console.log(`📋 Found ${orders?.length || 0} orders`);

      // Process each order to check presentation readiness and get documents
      const processedOrders: PresentationOrder[] = await Promise.all(
        (orders || []).map(async (order) => {
          console.log(`🔍 Processing order: ${order.id} for ${order.patient.profile.first_name} ${order.patient.profile.last_name}`);

          // Check if all sessions are completed using our database function
          const { data: sessionCheck, error: sessionError } = await supabase
            .rpc('check_presentation_ready', { order_id: order.id });

          if (sessionError) {
            console.error("Error checking sessions:", sessionError);
          }

          const sessions_completed = sessionCheck || false;
          console.log(`📊 Sessions completed for order ${order.id}: ${sessions_completed}`);

          // Get presentation documents
          const { data: documents, error: docsError } = await supabase
            .from("presentation_documents")
            .select(`
              id,
              document_type,
              file_url,
              file_name,
              uploaded_at,
              uploaded_by,
              uploader:profiles!presentation_documents_uploaded_by_fkey(first_name, last_name)
            `)
            .eq("medical_order_id", order.id);

          if (docsError) {
            console.error("Error fetching documents:", docsError);
          }

          // Organize documents by type
          const documentsByType = {
            medical_order: null as DocumentInfo | null,
            clinical_evolution: null as DocumentInfo | null,
            attendance_record: null as DocumentInfo | null,
            social_work_authorization: null as DocumentInfo | null,
          };

          // Medical order document (from the order itself)
          if (order.attachment_url) {
            documentsByType.medical_order = {
              id: 'medical_order',
              file_url: order.attachment_url,
              file_name: order.attachment_name || 'Orden médica',
              uploaded_by: 'system',
              uploaded_at: order.created_at,
              uploader_name: 'Sistema'
            };
          }

          // Other documents from presentation_documents table
          documents?.forEach((doc: any) => {
            if (doc.document_type === 'clinical_evolution') {
              documentsByType.clinical_evolution = {
                id: doc.id,
                file_url: doc.file_url,
                file_name: doc.file_name,
                uploaded_by: doc.uploaded_by,
                uploaded_at: doc.uploaded_at,
                uploader_name: `${doc.uploader?.first_name || ''} ${doc.uploader?.last_name || ''}`.trim()
              };
            } else if (doc.document_type === 'attendance_record') {
              documentsByType.attendance_record = {
                id: doc.id,
                file_url: doc.file_url,
                file_name: doc.file_name,
                uploaded_by: doc.uploaded_by,
                uploaded_at: doc.uploaded_at,
                uploader_name: `${doc.uploader?.first_name || ''} ${doc.uploader?.last_name || ''}`.trim()
              };
            } else if (doc.document_type === 'social_work_authorization') {
              documentsByType.social_work_authorization = {
                id: doc.id,
                file_url: doc.file_url,
                file_name: doc.file_name,
                uploaded_by: doc.uploaded_by,
                uploaded_at: doc.uploaded_at,
                uploader_name: `${doc.uploader?.first_name || ''} ${doc.uploader?.last_name || ''}`.trim()
              };
            }
          });

          return {
            ...order,
            documents: documentsByType,
            sessions_completed
          };
        })
      );

      // Filter by search term
      let filteredOrders = processedOrders;
      if (filters.search_term) {
        const searchLower = filters.search_term.toLowerCase();
        filteredOrders = processedOrders.filter(order =>
          order.patient.profile.first_name.toLowerCase().includes(searchLower) ||
          order.patient.profile.last_name.toLowerCase().includes(searchLower) ||
          order.patient.profile.dni?.toLowerCase().includes(searchLower) ||
          order.description.toLowerCase().includes(searchLower)
        );
      }

      // Filter by professional
      if (filters.professional) {
        filteredOrders = filteredOrders.filter(order =>
          order.doctor_name?.toLowerCase().includes(filters.professional.toLowerCase())
        );
      }

      // Filter by status
      if (filters.status !== 'all') {
        filteredOrders = filteredOrders.filter(order => {
          const isComplete = order.documents.medical_order && 
                           order.documents.clinical_evolution && 
                           order.documents.attendance_record &&
                           order.documents.social_work_authorization &&
                           order.sessions_completed;
          
          switch (filters.status) {
            case 'complete':
              return isComplete;
            case 'incomplete':
              return !isComplete;
            case 'submitted':
              return order.presentation_status === 'submitted';
            default:
              return true;
          }
        });
      }

      // Only show orders where sessions are completed (main requirement)
      const readyOrders = filteredOrders.filter(order => order.sessions_completed);

      console.log(`✅ Final filtered orders: ${readyOrders.length}`);
      return readyOrders;
    },
    enabled: true
  });

  const handleFileUpload = async (orderId: string, documentType: 'clinical_evolution' | 'attendance_record' | 'social_work_authorization', file: File, existingDocId?: string) => {
    if (!profile) return;

    try {
      setUploadingDoc(documentType);
      
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${documentType}/${orderId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('medical-orders')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Save or update document record
      if (existingDocId && editMode) {
        // Update existing document
        const { error: docError } = await supabase
          .from('presentation_documents')
          .update({
            file_url: fileName,
            file_name: file.name,
            uploaded_by: profile.id,
            uploaded_at: new Date().toISOString()
          })
          .eq('id', existingDocId);

        if (docError) throw docError;
        toast.success("Documento actualizado correctamente");
      } else {
        // Create new document
        const { error: docError } = await supabase
          .from('presentation_documents')
          .upsert({
            medical_order_id: orderId,
            document_type: documentType,
            file_url: fileName,
            file_name: file.name,
            uploaded_by: profile.id
          });

        if (docError) throw docError;
        toast.success("Documento cargado correctamente");
      }

      refetch();
      setIsUploadDialogOpen(false);
      setEditMode(false);
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error(editMode ? "Error al actualizar el documento" : "Error al cargar el documento");
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleEditDocument = (order: PresentationOrder, documentType: 'clinical_evolution' | 'attendance_record' | 'social_work_authorization') => {
    setSelectedOrder(order);
    setUploadType(documentType);
    setEditMode(true);
    setIsUploadDialogOpen(true);
  };

  const handleViewDocument = async (fileUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('medical-orders')
        .createSignedUrl(fileUrl, 3600);

      if (error) {
        // Fallback to public URL
        const { data: publicData } = supabase.storage
          .from('medical-orders')
          .getPublicUrl(fileUrl);
        
        if (publicData.publicUrl) {
          window.open(publicData.publicUrl, '_blank');
          return;
        }
        throw error;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error("Error viewing document:", error);
      toast.error("No se pudo abrir el documento");
    }
  };

  const markAsSubmitted = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('medical_orders')
        .update({ presentation_status: 'submitted' })
        .eq('id', orderId);

      if (error) throw error;

      toast.success("Presentación marcada como enviada");
      refetch();
    } catch (error) {
      console.error("Error marking as submitted:", error);
      toast.error("Error al marcar como enviada");
    }
  };

  const downloadDocument = async (fileUrl: string): Promise<Blob | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('medical-orders')
        .createSignedUrl(fileUrl, 3600);

      if (error) {
        const { data: publicData } = supabase.storage
          .from('medical-orders')
          .getPublicUrl(fileUrl);
        
        if (publicData.publicUrl) {
          const response = await fetch(publicData.publicUrl);
          return await response.blob();
        }
        throw error;
      }

      if (data?.signedUrl) {
        const response = await fetch(data.signedUrl);
        return await response.blob();
      }
      return null;
    } catch (error) {
      console.error("Error downloading document:", error);
      return null;
    }
  };

  const generatePDF = async (order: PresentationOrder) => {
    try {
      setGeneratingPdf(order.id);
      
      // Validate all documents are present
      const docs = order.documents;
      if (!docs.medical_order || !docs.clinical_evolution || !docs.attendance_record || !docs.social_work_authorization) {
        toast.error("Faltan documentos requeridos para generar el PDF");
        return;
      }

      // Create new PDF document
      const pdfDoc = await PDFDocument.create();
      const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

      // Create enhanced professional cover page
      const coverPage = pdfDoc.addPage();
      const { width, height } = coverPage.getSize();
      
      // Define colors using RGB values for professional medical theme
      const primaryBlue = rgb(0.2, 0.4, 0.8);     // Professional blue
      const lightBlue = rgb(0.85, 0.92, 0.98);    // Light blue background
      const darkGray = rgb(0.2, 0.2, 0.2);        // Dark text
      const mediumGray = rgb(0.4, 0.4, 0.4);      // Medium gray text
      const accentGreen = rgb(0.2, 0.7, 0.5);     // Medical green accent
      
      // Header background with gradient effect (simulated with rectangles)
      coverPage.drawRectangle({
        x: 0,
        y: height - 140,
        width: width,
        height: 140,
        color: primaryBlue,
      });
      
      // Light blue accent strip
      coverPage.drawRectangle({
        x: 0,
        y: height - 150,
        width: width,
        height: 10,
        color: lightBlue,
      });
      
      // Medical center logo placeholder (space for future logo)
      coverPage.drawRectangle({
        x: 50,
        y: height - 120,
        width: 80,
        height: 60,
        color: rgb(1, 1, 1),
        borderColor: lightBlue,
        borderWidth: 2,
      });
      
      coverPage.drawText('LOGO', {
        x: 70,
        y: height - 95,
        size: 12,
        font: timesRomanFont,
        color: mediumGray
      });
      
      // Medical center name
      coverPage.drawText('CENTRO MÉDICO MEDITURNOS', {
        x: 150,
        y: height - 70,
        size: 20,
        font: timesRomanBoldFont,
        color: rgb(1, 1, 1)
      });
      
      // Subtitle
      coverPage.drawText('Servicios Médicos Profesionales', {
        x: 150,
        y: height - 95,
        size: 12,
        font: timesRomanFont,
        color: lightBlue
      });
      
      // Main document title
      let yPosition = height - 200;
      coverPage.drawText('PRESENTACIÓN DE DOCUMENTACIÓN MÉDICA', {
        x: width / 2 - 180,
        y: yPosition,
        size: 22,
        font: timesRomanBoldFont,
        color: primaryBlue
      });
      
      // Decorative line under title
      coverPage.drawLine({
        start: { x: 50, y: yPosition - 15 },
        end: { x: width - 50, y: yPosition - 15 },
        thickness: 2,
        color: accentGreen
      });
      
      // Patient information section
      yPosition = height - 280;
      
      // Section header with background
      coverPage.drawRectangle({
        x: 50,
        y: yPosition - 5,
        width: width - 100,
        height: 25,
        color: lightBlue,
      });
      
      coverPage.drawText('📋 DATOS DEL PACIENTE', {
        x: 60,
        y: yPosition,
        size: 14,
        font: timesRomanBoldFont,
        color: primaryBlue
      });
      
      yPosition -= 40;
      const patientData = [
        { label: 'Nombre completo:', value: `${order.patient.profile.first_name} ${order.patient.profile.last_name}` },
        { label: 'DNI:', value: order.patient.profile.dni || 'No especificado' },
        { label: 'Obra Social/ART:', value: `${order.obra_social.nombre} (${order.obra_social.tipo})` }
      ];
      
      patientData.forEach((item, index) => {
        coverPage.drawText(`${item.label}`, {
          x: 60,
          y: yPosition,
          size: 11,
          font: timesRomanBoldFont,
          color: darkGray
        });
        
        coverPage.drawText(item.value, {
          x: 200,
          y: yPosition,
          size: 11,
          font: timesRomanFont,
          color: darkGray
        });
        yPosition -= 22;
      });
      
      // Medical order information section
      yPosition -= 20;
      
      // Section header with background
      coverPage.drawRectangle({
        x: 50,
        y: yPosition - 5,
        width: width - 100,
        height: 25,
        color: lightBlue,
      });
      
      coverPage.drawText('🏥 INFORMACIÓN DEL TRATAMIENTO', {
        x: 60,
        y: yPosition,
        size: 14,
        font: timesRomanBoldFont,
        color: primaryBlue
      });
      
      yPosition -= 40;
      const treatmentData = [
        { label: 'ID de Orden:', value: order.id.substring(0, 8).toUpperCase() },
        { label: 'Profesional:', value: order.doctor_name || 'No especificado' },
        { label: 'Sesiones aprobadas:', value: order.total_sessions.toString() },
        { label: 'Sesiones realizadas:', value: order.sessions_used.toString() },
        { label: 'Fecha de creación:', value: format(new Date(order.created_at), "dd/MM/yyyy", { locale: es }) },
        { label: 'Fecha de cierre:', value: order.completed ? format(new Date(), "dd/MM/yyyy", { locale: es }) : 'En curso' }
      ];
      
      treatmentData.forEach((item, index) => {
        coverPage.drawText(`${item.label}`, {
          x: 60,
          y: yPosition,
          size: 11,
          font: timesRomanBoldFont,
          color: darkGray
        });
        
        coverPage.drawText(item.value, {
          x: 200,
          y: yPosition,
          size: 11,
          font: timesRomanFont,
          color: darkGray
        });
        yPosition -= 22;
      });
      
      // Treatment description section
      yPosition -= 20;
      
      coverPage.drawRectangle({
        x: 50,
        y: yPosition - 5,
        width: width - 100,
        height: 25,
        color: lightBlue,
      });
      
      coverPage.drawText('📝 DESCRIPCIÓN DEL TRATAMIENTO', {
        x: 60,
        y: yPosition,
        size: 14,
        font: timesRomanBoldFont,
        color: primaryBlue
      });
      
      yPosition -= 30;
      
      // Split description into multiple lines if needed
      const maxLineLength = 70;
      const descriptionLines = order.description.length > maxLineLength 
        ? order.description.match(new RegExp(`.{1,${maxLineLength}}(\\s|$)`, 'g')) || [order.description]
        : [order.description];
      
      descriptionLines.forEach((line) => {
        coverPage.drawText(line.trim(), {
          x: 60,
          y: yPosition,
          size: 11,
          font: timesRomanFont,
          color: darkGray
        });
        yPosition -= 18;
      });
      
      // Documents included section
      yPosition = 180;
      
      coverPage.drawRectangle({
        x: 50,
        y: yPosition - 5,
        width: width - 100,
        height: 25,
        color: lightBlue,
      });
      
      coverPage.drawText('📂 DOCUMENTOS INCLUIDOS EN ESTA PRESENTACIÓN', {
        x: 60,
        y: yPosition,
        size: 14,
        font: timesRomanBoldFont,
        color: primaryBlue
      });
      
      yPosition -= 35;
      const documentsIncluded = [
        '• Orden médica original',
        '• Autorización de obra social/ART',
        '• Evolutivo clínico completo',
        '• Registro de asistencia del paciente'
      ];
      
      documentsIncluded.forEach((doc) => {
        coverPage.drawText(doc, {
          x: 60,
          y: yPosition,
          size: 11,
          font: timesRomanFont,
          color: darkGray
        });
        yPosition -= 20;
      });
      
      // Footer with generation info
      const footerY = 50;
      
      // Footer background
      coverPage.drawRectangle({
        x: 0,
        y: footerY - 20,
        width: width,
        height: 40,
        color: rgb(0.95, 0.95, 0.95),
      });
      
      coverPage.drawText(`Documento generado el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`, {
        x: 60,
        y: footerY,
        size: 10,
        font: timesRomanFont,
        color: mediumGray
      });
      
      coverPage.drawText('Sistema Mediturnos - Gestión Médica Profesional', {
        x: width - 280,
        y: footerY,
        size: 10,
        font: timesRomanFont,
        color: mediumGray
      });

      // Process and add documents in order (without separators)
      const documentsToProcess = [
        docs.medical_order,
        docs.social_work_authorization,
        docs.clinical_evolution,
        docs.attendance_record
      ];

      for (const doc of documentsToProcess) {
        if (!doc) continue;

        try {
          // Download the document
          const blob = await downloadDocument(doc.file_url);
          
          if (blob) {
            if (blob.type.includes('pdf')) {
              // Handle PDF files - add pages directly without separator
              const arrayBuffer = await blob.arrayBuffer();
              const existingPdf = await PDFDocument.load(arrayBuffer);
              const pages = await pdfDoc.copyPages(existingPdf, existingPdf.getPageIndices());
              
              pages.forEach((page) => pdfDoc.addPage(page));
              
            } else if (blob.type.includes('image')) {
              // Handle image files - add directly without separator
              const arrayBuffer = await blob.arrayBuffer();
              let image;
              
              if (blob.type.includes('png')) {
                image = await pdfDoc.embedPng(arrayBuffer);
              } else {
                image = await pdfDoc.embedJpg(arrayBuffer);
              }
              
              const imagePage = pdfDoc.addPage();
              const { width: pageWidth, height: pageHeight } = imagePage.getSize();
              
              // Calculate scaling to fit image in page with margins
              const maxWidth = pageWidth - 40; // Smaller margins for cleaner look
              const maxHeight = pageHeight - 40;
              
              const imageScale = Math.min(
                maxWidth / image.width,
                maxHeight / image.height
              );
              
              const scaledWidth = image.width * imageScale;
              const scaledHeight = image.height * imageScale;
              
              // Center the image
              const x = (pageWidth - scaledWidth) / 2;
              const y = (pageHeight - scaledHeight) / 2;
              
              imagePage.drawImage(image, {
                x,
                y,
                width: scaledWidth,
                height: scaledHeight
              });
            }
          } else {
            console.warn(`Could not load document: ${doc.file_name}`);
          }
        } catch (error) {
          console.error(`Error processing document ${doc.file_name}:`, error);
        }
      }

      // Generate the PDF
      const pdfBytes = await pdfDoc.save();
      
      // Create filename
      const fileName = `Presentacion_${order.patient.profile.last_name.replace(/[^a-zA-Z0-9]/g, '_')}_${order.obra_social.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      
      // Download the PDF
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Mark as PDF generated
      await supabase
        .from('medical_orders')
        .update({ presentation_status: 'pdf_generated' })
        .eq('id', order.id);

      toast.success("PDF generado y descargado correctamente");
      refetch();

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el PDF");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const getDocumentStatus = (order: PresentationOrder) => {
    const docs = order.documents;
    const hasAllDocs = docs.medical_order && docs.clinical_evolution && docs.attendance_record && docs.social_work_authorization;
    const sessionsReady = order.sessions_completed;
    
    if (!sessionsReady) return { 
      status: 'sessions_pending', 
      color: 'bg-orange-100 text-orange-800', 
      text: 'Sesiones pendientes', 
      icon: '🟠' 
    };
    
    if (order.presentation_status === 'pdf_generated') return { 
      status: 'pdf_generated', 
      color: 'bg-green-100 text-green-800', 
      text: '🟢 PDF generado', 
      icon: '🟢' 
    };
    
    if (hasAllDocs && sessionsReady) return { 
      status: 'ready_to_generate', 
      color: 'bg-yellow-100 text-yellow-800', 
      text: '🟡 Lista para generar', 
      icon: '🟡' 
    };
    
    return { 
      status: 'incomplete', 
      color: 'bg-red-100 text-red-800', 
      text: '🔴 Incompleta', 
      icon: '🔴' 
    };
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Presentaciones</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button className="gap-2">
            <Send className="h-4 w-4" />
            Enviar Lote
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Obra Social / ART</Label>
               <Select value={filters.obra_social_id} onValueChange={(value) => setFilters(prev => ({ ...prev, obra_social_id: value === "all" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las obras sociales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {obrasSociales?.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nombre} ({obra.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Profesional</Label>
              <Input
                placeholder="Buscar por profesional..."
                value={filters.professional}
                onChange={(e) => setFilters(prev => ({ ...prev, professional: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={filters.status} onValueChange={(value: any) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="complete">Completas</SelectItem>
                  <SelectItem value="incomplete">Incompletas</SelectItem>
                  <SelectItem value="submitted">Enviadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Buscar paciente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nombre o DNI..."
                  value={filters.search_term}
                  onChange={(e) => setFilters(prev => ({ ...prev, search_term: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha desde</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha hasta</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Presentations List */}
      <div className="space-y-4">
        {!presentations || presentations.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay presentaciones que mostrar</p>
              <p className="text-sm">Las órdenes aparecerán aquí cuando todas sus sesiones estén completadas</p>
            </CardContent>
          </Card>
        ) : (
          presentations.map((order) => {
            const docStatus = getDocumentStatus(order);
            
            return (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {order.patient.profile.first_name} {order.patient.profile.last_name}
                        {order.patient.profile.dni && (
                          <span className="text-sm text-muted-foreground font-normal">
                            DNI: {order.patient.profile.dni}
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {order.obra_social.nombre}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(order.created_at), "dd/MM/yyyy", { locale: es })}
                        </span>
                        {order.doctor_name && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Dr. {order.doctor_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={docStatus.color} variant="secondary">
                        {docStatus.text}
                      </Badge>
                      {order.presentation_status === 'submitted' && (
                        <Badge className="bg-blue-100 text-blue-800" variant="secondary">
                          Enviada
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Order Description */}
                  <div className="p-3 bg-muted rounded-lg">
                    <h4 className="font-medium text-sm mb-1">Descripción de la Orden</h4>
                    <p className="text-sm text-muted-foreground">{order.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{presentations?.filter(p => p.patient.id === order.patient.id && p.sessions_completed).length || 0} presentaciones de {presentations?.filter(p => p.patient.id === order.patient.id).length || 0} órdenes</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {order.sessions_completed ? 'Tratamiento finalizado' : 'En progreso'}
                      </span>
                    </div>
                  </div>

                  {/* Documents Checklist */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Medical Order Document */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium text-sm">Orden Médica</span>
                        {order.documents.medical_order ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      {order.documents.medical_order ? (
                        <div className="space-y-1">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs"
                            onClick={() => handleViewDocument(order.documents.medical_order!.file_url)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver documento
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Cargado: {format(new Date(order.documents.medical_order.uploaded_at), "dd/MM/yy HH:mm", { locale: es })}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-red-600">❌ No disponible</p>
                      )}
                    </div>

                    {/* Clinical Evolution */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium text-sm">Evolutivo Clínico</span>
                        {order.documents.clinical_evolution ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      {order.documents.clinical_evolution ? (
                        <div className="space-y-1">
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 text-xs"
                              onClick={() => handleViewDocument(order.documents.clinical_evolution!.file_url)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs px-2"
                              onClick={() => handleEditDocument(order, 'clinical_evolution')}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Por: {order.documents.clinical_evolution.uploader_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.documents.clinical_evolution.uploaded_at), "dd/MM/yy HH:mm", { locale: es })}
                          </p>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => {
                            setSelectedOrder(order);
                            setUploadType('clinical_evolution');
                            setIsUploadDialogOpen(true);
                          }}
                          disabled={!order.sessions_completed}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Subir evolutivo
                        </Button>
                      )}
                    </div>

                    {/* Attendance Record */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium text-sm">Registro Asistencia</span>
                        {order.documents.attendance_record ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      {order.documents.attendance_record ? (
                        <div className="space-y-1">
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 text-xs"
                              onClick={() => handleViewDocument(order.documents.attendance_record!.file_url)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs px-2"
                              onClick={() => handleEditDocument(order, 'attendance_record')}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Por: {order.documents.attendance_record.uploader_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.documents.attendance_record.uploaded_at), "dd/MM/yy HH:mm", { locale: es })}
                          </p>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => {
                            setSelectedOrder(order);
                            setUploadType('attendance_record');
                            setIsUploadDialogOpen(true);
                          }}
                          disabled={!order.sessions_completed}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Subir registro
                        </Button>
                      )}
                    </div>

                    {/* Social Work Authorization */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium text-sm">Autorización Obra Social</span>
                        {order.documents.social_work_authorization ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      {order.documents.social_work_authorization ? (
                        <div className="space-y-1">
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 text-xs"
                              onClick={() => handleViewDocument(order.documents.social_work_authorization!.file_url)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs px-2"
                              onClick={() => handleEditDocument(order, 'social_work_authorization')}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Por: {order.documents.social_work_authorization.uploader_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.documents.social_work_authorization.uploaded_at), "dd/MM/yy HH:mm", { locale: es })}
                          </p>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => {
                            setSelectedOrder(order);
                            setUploadType('social_work_authorization');
                            setIsUploadDialogOpen(true);
                          }}
                          disabled={!order.sessions_completed}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Subir autorización
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end pt-2 border-t">
                    <div className="flex gap-2">
                      {docStatus.status === 'ready_to_generate' && (
                        <Button 
                          onClick={() => generatePDF(order)}
                          className="gap-2"
                          disabled={generatingPdf === order.id}
                        >
                          <FileDown className="h-4 w-4" />
                          {generatingPdf === order.id ? 'Generando...' : 'Generar PDF'}
                        </Button>
                      )}
                      
                      {docStatus.status === 'pdf_generated' && (
                        <>
                          <Button 
                            variant="outline"
                            onClick={() => generatePDF(order)}
                            className="gap-2"
                            disabled={generatingPdf === order.id}
                          >
                            <FileDown className="h-4 w-4" />
                            Regenerar PDF
                          </Button>
                          
                          <Button 
                            onClick={() => markAsSubmitted(order.id)}
                            className="gap-2"
                          >
                            <Send className="h-4 w-4" />
                            Marcar como Enviada
                          </Button>
                        </>
                      )}
                      
                      {docStatus.status === 'incomplete' && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <AlertCircle className="h-4 w-4" />
                          Complete todos los documentos para generar PDF
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editMode ? 'Reemplazar' : 'Subir'} {
                uploadType === 'clinical_evolution' ? 'Evolutivo Clínico' : 
                uploadType === 'attendance_record' ? 'Registro de Asistencia' :
                'Autorización de Obra Social'
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedOrder && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p><strong>Paciente:</strong> {selectedOrder.patient.profile.first_name} {selectedOrder.patient.profile.last_name}</p>
                <p><strong>Orden:</strong> {selectedOrder.description}</p>
              </div>
            )}
            <div>
              <Label htmlFor="document-file">Seleccionar archivo</Label>
              <Input
                id="document-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && selectedOrder && uploadType) {
                    const existingDoc = selectedOrder.documents[uploadType];
                    const existingDocId = existingDoc?.id;
                    handleFileUpload(selectedOrder.id, uploadType, file, existingDocId);
                  }
                }}
                disabled={!!uploadingDoc}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formatos permitidos: PDF, JPG, PNG, DOC, DOCX
              </p>
            </div>
            {editMode && selectedOrder && uploadType && selectedOrder.documents[uploadType] && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium">⚠️ Reemplazando documento existente</p>
                <p className="text-xs text-yellow-700">
                  Archivo actual: {selectedOrder.documents[uploadType]!.file_name}
                </p>
              </div>
            )}
            {uploadingDoc && (
              <p className="text-sm text-blue-600">{editMode ? 'Actualizando' : 'Subiendo'} documento...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
