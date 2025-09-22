import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { usePaginatedPresentations, type PresentationOrder as OptimizedPresentationOrder } from "@/hooks/usePaginatedPresentations";
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
  Edit2,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Complete PresentationOrder interface with all document management
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
  actual_completed_sessions?: number;
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
  status: 'all' | 'ready_to_present' | 'in_preparation' | 'missing_attendance' | 'pdf_generated' | 'submitted';
  search_term: string;
  page: number;
}

export default function Presentaciones() {
  const { profile } = useAuth();
  
  // Establecer fechas por defecto: última semana
  const getDefaultDates = () => {
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    
    return {
      date_from: oneWeekAgo.toISOString().split('T')[0],
      date_to: today.toISOString().split('T')[0]
    };
  };
  
  const [filters, setFilters] = useState<FilterState>({
    obra_social_id: 'all',
    professional: '',
    ...getDefaultDates(),
    status: 'all',
    search_term: '',
    page: 1
  });
  
  const [selectedOrder, setSelectedOrder] = useState<PresentationOrder | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'clinical_evolution' | 'attendance_record' | 'social_work_authorization' | null>(null);
  const [isMultiUpload, setIsMultiUpload] = useState(false);
  const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<('clinical_evolution' | 'attendance_record' | 'social_work_authorization')[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{orderId: string, docType: 'clinical_evolution' | 'attendance_record' | 'social_work_authorization', docId: string} | null>(null);
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<{url: string, name: string, type: string, originalPath?: string} | null>(null);

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

  // Enhanced presentation orders query with full document management
  const { data: presentations, isLoading, refetch } = useQuery({
    queryKey: ["presentations-enhanced", filters],
    queryFn: async () => {
      console.log("🔍 Cargando presentaciones con filtros optimizados:", filters);
      
      try {
        // Use optimized query for base filtering
        const { data: baseData, error: baseError } = await supabase.rpc('search_presentations_paginated', {
          search_term: filters.search_term?.trim() || null,
          obra_social_filter: filters.obra_social_id === 'all' ? null : filters.obra_social_id,
          professional_filter: null, // Professional filter via text search for now
          status_filter: filters.status === 'all' ? null : filters.status,
          date_from: filters.date_from || null,
          date_to: filters.date_to || null,
          page_number: filters.page,
          page_size: 50
        });

        if (baseError) throw baseError;

        const optimizedOrders = baseData?.map((row: any) => row.presentation_data) || [];
        const totalCount = baseData?.[0]?.total_count || 0;

        console.log(`📋 Base optimized orders: ${optimizedOrders.length}`);

        // Enhance each order with full document information
        const enhancedOrders: PresentationOrder[] = await Promise.all(
          optimizedOrders.map(async (order: OptimizedPresentationOrder) => {
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

            // Medical order document (from the order itself) - use optimized data
            if (order.id) {
              // Get attachment info from medical_orders table
              const { data: orderData } = await supabase
                .from('medical_orders')
                .select('attachment_url, attachment_name, created_at')
                .eq('id', order.id)
                .single();

              if (orderData?.attachment_url) {
                documentsByType.medical_order = {
                  id: 'medical_order',
                  file_url: orderData.attachment_url,
                  file_name: orderData.attachment_name || 'Orden médica',
                  uploaded_by: 'system',
                  uploaded_at: orderData.created_at,
                  uploader_name: 'Sistema'
                };
              }
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

            // Convert optimized order to full PresentationOrder format
            return {
              id: order.id,
              description: order.description,
              total_sessions: order.total_sessions,
              sessions_used: order.sessions_used,
              completed: order.completed,
              presentation_status: order.presentation_status || 'pending',
              patient: {
                id: order.patient_id,
                profile: {
                  first_name: order.patient_name?.split(' ')[0] || '',
                  last_name: order.patient_name?.split(' ').slice(1).join(' ') || '',
                  dni: order.patient_dni || null,
                }
              },
              obra_social: {
                id: order.obra_social_art_id || '',
                nombre: order.obra_social_name || 'Sin obra social',
                tipo: order.obra_social_type || 'particular'
              },
              doctor_name: order.professional_name,
              created_at: order.created_at,
              attachment_url: documentsByType.medical_order?.file_url || null,
              attachment_name: documentsByType.medical_order?.file_name || null,
              documents: documentsByType,
              sessions_completed: order.sessions_completed,
              actual_completed_sessions: order.completed_appointments_count
            } as PresentationOrder;
          })
        );

        console.log(`✅ Enhanced orders: ${enhancedOrders.length}`);
        return { 
          presentations: enhancedOrders, 
          totalCount, 
          totalPages: Math.ceil(totalCount / 50) 
        };

      } catch (error) {
        console.error("❌ Error in enhanced presentations query:", error);
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const presentationOrders = presentations?.presentations || [];
  const totalCount = presentations?.totalCount || 0;
  const totalPages = presentations?.totalPages || 1;

  // Document management functions - RESTORED COMPLETE FUNCTIONALITY
  const handleFileUpload = async (
    orderId: string, 
    documentTypes: ('clinical_evolution' | 'attendance_record' | 'social_work_authorization')[], 
    file: File, 
    existingDocId?: string
  ) => {
    if (!profile) return;

    try {
      setUploadingDoc('multiple');
      
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `combined/${orderId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('medical-orders')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Generate shared file ID for multiple document types
      const sharedFileId = documentTypes.length > 1 ? crypto.randomUUID() : null;

      if (existingDocId && editMode) {
        // Update existing document - only for single document edit mode
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
        // Create new document(s) - one record per document type
        for (const docType of documentTypes) {
          const { error: docError } = await supabase
            .from('presentation_documents')
            .insert({
              medical_order_id: orderId,
              document_type: docType,
              file_url: fileName,
              file_name: file.name,
              uploaded_by: profile.id,
              shared_file_id: sharedFileId
            });

          if (docError) throw docError;
        }
        
        const message = documentTypes.length > 1 
          ? `Archivo subido para ${documentTypes.length} tipos de documento`
          : "Documento subido correctamente";
        toast.success(message);
      }

      // Refresh data
      refetch();
      setIsUploadDialogOpen(false);
      setEditMode(false);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error("Error al subir el archivo");
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleSingleFileUpload = async (orderId: string, docType: 'clinical_evolution' | 'attendance_record' | 'social_work_authorization', file: File) => {
    return handleFileUpload(orderId, [docType], file);
  };

  const handleEditDocument = (orderId: string, docType: 'clinical_evolution' | 'attendance_record' | 'social_work_authorization') => {
    setSelectedOrder(presentationOrders.find(p => p.id === orderId) || null);
    setUploadType(docType);
    setEditMode(true);
    setIsUploadDialogOpen(true);
  };

  const handleDeleteDocument = async (orderId: string, docType: 'clinical_evolution' | 'attendance_record' | 'social_work_authorization', docId: string) => {
    try {
      const { error } = await supabase
        .from('presentation_documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      toast.success("Documento eliminado correctamente");
      refetch();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error("Error al eliminar el documento");
    }
  };

  const confirmDeleteDocument = (orderId: string, docType: 'clinical_evolution' | 'attendance_record' | 'social_work_authorization', docId: string) => {
    setDocumentToDelete({ orderId, docType, docId });
    setDeleteConfirmOpen(true);
  };

  const handleDownloadDocument = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('medical-orders')
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Archivo descargado");
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error("Error al descargar el archivo");
    }
  };

  const handleViewDocument = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('medical-orders')
        .createSignedUrl(fileUrl, 60);

      if (error) throw error;

      const fileType = fileName.split('.').pop()?.toLowerCase() || '';
      
      setViewingDocument({
        url: data.signedUrl,
        name: fileName,
        type: fileType,
        originalPath: fileUrl
      });
      setDocumentViewerOpen(true);
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error("Error al visualizar el documento");
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
      console.error('Error marking as submitted:', error);
      toast.error("Error al marcar como enviada");
    }
  };

  const downloadDocument = async (fileUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('medical-orders')
        .download(fileUrl);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error downloading document:', error);
      throw error;
    }
  };

  const validateDocumentsForPDF = (order: PresentationOrder) => {
    const docs = order.documents;
    const hasAllDocs = docs.medical_order && docs.clinical_evolution && docs.attendance_record && docs.social_work_authorization;
    const sessionsCompleted = order.sessions_completed;
    return hasAllDocs && sessionsCompleted;
  };

  const generatePDF = async (order: PresentationOrder) => {
    if (!validateDocumentsForPDF(order)) {
      toast.error("La presentación no tiene todos los documentos o sesiones necesarios");
      return;
    }

    try {
      setGeneratingPdf(order.id);
      toast.info("Generando PDF consolidado...");

      // Get all documents for this order
      const { data: documents, error: docsError } = await supabase
        .from("presentation_documents")
        .select('*')
        .eq("medical_order_id", order.id);

      if (docsError) throw docsError;

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Add title page
      const titlePage = pdfDoc.addPage();
      const { width, height } = titlePage.getSize();

      titlePage.drawText('PRESENTACIÓN MÉDICA', {
        x: 50,
        y: height - 100,
        size: 24,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      const patientName = `${order.patient.profile.first_name} ${order.patient.profile.last_name}`;
      titlePage.drawText(`Paciente: ${patientName}`, {
        x: 50,
        y: height - 150,
        size: 14,
        font: font,
      });

      titlePage.drawText(`Obra Social: ${order.obra_social.nombre}`, {
        x: 50,
        y: height - 180,
        size: 14,
        font: font,
      });

      titlePage.drawText(`Profesional: ${order.doctor_name || 'Sin asignar'}`, {
        x: 50,
        y: height - 210,
        size: 14,
        font: font,
      });

      titlePage.drawText(`Descripción: ${order.description}`, {
        x: 50,
        y: height - 240,
        size: 14,
        font: font,
      });

      titlePage.drawText(`Sesiones: ${order.actual_completed_sessions}/${order.total_sessions}`, {
        x: 50,
        y: height - 270,
        size: 14,
        font: font,
      });

      titlePage.drawText(`Fecha de generación: ${new Date().toLocaleDateString('es-AR')}`, {
        x: 50,
        y: height - 300,
        size: 12,
        font: font,
      });

      // Add medical order document first
      if (order.documents.medical_order) {
        try {
          const docData = await downloadDocument(order.documents.medical_order.file_url);
          const docBytes = await docData.arrayBuffer();
          
          if (order.documents.medical_order.file_name.toLowerCase().endsWith('.pdf')) {
            const embeddedPdf = await PDFDocument.load(docBytes);
            const pages = await pdfDoc.copyPages(embeddedPdf, embeddedPdf.getPageIndices());
            pages.forEach((page) => pdfDoc.addPage(page));
          }
        } catch (error) {
          console.error(`Error embedding medical order:`, error);
        }
      }

      // Add other documents
      for (const doc of documents || []) {
        try {
          const docData = await downloadDocument(doc.file_url);
          const docBytes = await docData.arrayBuffer();
          
          if (doc.file_name.toLowerCase().endsWith('.pdf')) {
            const embeddedPdf = await PDFDocument.load(docBytes);
            const pages = await pdfDoc.copyPages(embeddedPdf, embeddedPdf.getPageIndices());
            pages.forEach((page) => pdfDoc.addPage(page));
          }
        } catch (error) {
          console.error(`Error embedding document ${doc.file_name}:`, error);
        }
      }

      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `presentacion_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Update presentation status
      await supabase
        .from('medical_orders')
        .update({ presentation_status: 'pdf_generated' })
        .eq('id', order.id);

      toast.success("PDF generado y descargado correctamente");
      refetch();
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Error al generar el PDF");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const getDocumentStatus = (presentation: PresentationOrder) => {
    const docs = presentation.documents;
    const hasAllDocs = docs.medical_order && docs.clinical_evolution && docs.attendance_record && docs.social_work_authorization;
    const sessionsCompleted = presentation.sessions_completed;
    const actualCompletedSessions = presentation.actual_completed_sessions || 0;
    
    const docCount = [
      docs.medical_order,
      docs.clinical_evolution,
      docs.attendance_record,
      docs.social_work_authorization
    ].filter(Boolean).length;

    return {
      hasAllDocs,
      sessionsCompleted,
      docCount,
      totalDocs: 4,
      canGeneratePDF: hasAllDocs && sessionsCompleted,
      actualCompletedSessions,
      totalSessions: presentation.total_sessions
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Presentaciones</h1>
            <p className="text-muted-foreground">Gestiona las presentaciones médicas y documentos</p>
          </div>
        </div>

        {/* FILTROS OPTIMIZADOS */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros Optimizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label htmlFor="obra-social">Obra Social</Label>
                <Select 
                  value={filters.obra_social_id} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, obra_social_id: value, page: 1 }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {obrasSociales?.map((os) => (
                      <SelectItem key={os.id} value={os.id}>
                        {os.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="professional">Profesional</Label>
                <Input
                  id="professional"
                  placeholder="Buscar profesional..."
                  value={filters.professional}
                  onChange={(e) => setFilters(prev => ({ ...prev, professional: e.target.value, page: 1 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as FilterState['status'], page: 1 }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ready_to_present">Listo para presentar</SelectItem>
                    <SelectItem value="in_preparation">En preparación</SelectItem>
                    <SelectItem value="missing_attendance">Falta planilla</SelectItem>
                    <SelectItem value="pdf_generated">PDF generado</SelectItem>
                    <SelectItem value="submitted">Presentado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-from">Fecha desde</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value, page: 1 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-to">Fecha hasta</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value, page: 1 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="search">Buscar (Optimizado)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Paciente, DNI..."
                    value={filters.search_term}
                    onChange={(e) => setFilters(prev => ({ ...prev, search_term: e.target.value, page: 1 }))}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PAGINACIÓN INFO */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              "Cargando..."
            ) : (
              `Mostrando ${((filters.page - 1) * 50) + 1}-${Math.min(filters.page * 50, totalCount)} de ${totalCount} presentaciones`
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={filters.page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Página {filters.page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                disabled={filters.page >= totalPages || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* RESULTADOS */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="mt-2 text-muted-foreground">Cargando presentaciones...</p>
            </div>
          ) : presentationOrders.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No se encontraron presentaciones</p>
                <p className="text-muted-foreground">Ajusta los filtros para ver más resultados</p>
              </CardContent>
            </Card>
          ) : (
            presentationOrders.map((order) => {
              const status = getDocumentStatus(order);
              const patientName = `${order.patient.profile.first_name} ${order.patient.profile.last_name}`.trim();
              const professionalName = order.doctor_name || 'Sin asignar';
              const obraSocialName = order.obra_social.nombre;

              return (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{patientName}</CardTitle>
                          {order.presentation_status === 'submitted' && (
                            <Badge variant="secondary" className="text-xs">
                              <Send className="h-3 w-3 mr-1" />
                              Presentado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{order.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Estado de sesiones */}
                        {status.sessionsCompleted ? (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Sesiones completas
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {status.actualCompletedSessions}/{status.totalSessions} sesiones
                          </Badge>
                        )}

                        {/* Estado de documentos */}
                        {status.hasAllDocs ? (
                          <Badge variant="default" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            {status.docCount}/4 documentos
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            {status.docCount}/4 documentos
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Profesional:</span>
                        <span className="font-medium">{professionalName}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Obra Social:</span>
                        <span className="font-medium">{obraSocialName}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Fecha:</span>
                        <span className="font-medium">
                          {new Date(order.created_at).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Gestionar Documentos
                        </Button>

                        {status.canGeneratePDF && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => generatePDF(order)}
                            disabled={generatingPdf === order.id}
                          >
                            {generatingPdf === order.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4 mr-1" />
                            )}
                            {generatingPdf === order.id ? 'Generando...' : 'Generar PDF'}
                          </Button>
                        )}
                      </div>

                      {status.canGeneratePDF && order.presentation_status !== 'submitted' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => markAsSubmitted(order.id)}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Marcar como Presentado
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* PAGINACIÓN */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center mt-6">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={filters.page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <span className="text-sm px-4">
                Página {filters.page} de {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setFilters(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                disabled={filters.page >= totalPages || isLoading}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* GESTIÓN DE DOCUMENTOS - DIÁLOGO COMPLETO RESTAURADO */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Gestionar Documentos - {selectedOrder && `${selectedOrder.patient.profile.first_name} ${selectedOrder.patient.profile.last_name}`}
              </DialogTitle>
            </DialogHeader>
            
            {selectedOrder && (
              <div className="space-y-6">
                {/* Estado de la presentación */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Estado de Sesiones</h3>
                    <div className="flex items-center gap-2">
                      {selectedOrder.sessions_completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                      <span>
                        {selectedOrder.actual_completed_sessions || 0}/{selectedOrder.total_sessions} sesiones completadas
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Estado General</h3>
                    <div className="flex items-center gap-2">
                      {getDocumentStatus(selectedOrder).canGeneratePDF ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      )}
                      <span>
                        {getDocumentStatus(selectedOrder).canGeneratePDF ? 'Lista para presentar' : 'Faltan documentos o sesiones'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Documentos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Documentos de la Presentación</h3>
                  
                  {/* Orden médica */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">📄 Orden Médica</h4>
                      {selectedOrder.documents.medical_order ? (
                        <Badge variant="default">Subido</Badge>
                      ) : (
                        <Badge variant="outline">Pendiente</Badge>
                      )}
                    </div>
                    
                    {selectedOrder.documents.medical_order ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm">{selectedOrder.documents.medical_order.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Subido por {selectedOrder.documents.medical_order.uploader_name} - {format(new Date(selectedOrder.documents.medical_order.uploaded_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewDocument(selectedOrder.documents.medical_order!.file_url, selectedOrder.documents.medical_order!.file_name)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(selectedOrder.documents.medical_order!.file_url, selectedOrder.documents.medical_order!.file_name)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay orden médica cargada</p>
                    )}
                  </div>

                  {/* Evolución clínica */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">📋 Evolución Clínica</h4>
                      {selectedOrder.documents.clinical_evolution ? (
                        <Badge variant="default">Subido</Badge>
                      ) : (
                        <Badge variant="outline">Pendiente</Badge>
                      )}
                    </div>
                    
                    {selectedOrder.documents.clinical_evolution ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm">{selectedOrder.documents.clinical_evolution.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Subido por {selectedOrder.documents.clinical_evolution.uploader_name} - {format(new Date(selectedOrder.documents.clinical_evolution.uploaded_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewDocument(selectedOrder.documents.clinical_evolution!.file_url, selectedOrder.documents.clinical_evolution!.file_name)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(selectedOrder.documents.clinical_evolution!.file_url, selectedOrder.documents.clinical_evolution!.file_name)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEditDocument(selectedOrder.id, 'clinical_evolution')}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => confirmDeleteDocument(selectedOrder.id, 'clinical_evolution', selectedOrder.documents.clinical_evolution!.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">No hay evolución clínica</p>
                        <Button size="sm" onClick={() => {
                          setUploadType('clinical_evolution');
                          setIsMultiUpload(false);
                          setIsUploadDialogOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Subir
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Planilla de asistencia */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">📊 Planilla de Asistencia</h4>
                      {selectedOrder.documents.attendance_record ? (
                        <Badge variant="default">Subido</Badge>
                      ) : (
                        <Badge variant="outline">Pendiente</Badge>
                      )}
                    </div>
                    
                    {selectedOrder.documents.attendance_record ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm">{selectedOrder.documents.attendance_record.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Subido por {selectedOrder.documents.attendance_record.uploader_name} - {format(new Date(selectedOrder.documents.attendance_record.uploaded_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewDocument(selectedOrder.documents.attendance_record!.file_url, selectedOrder.documents.attendance_record!.file_name)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(selectedOrder.documents.attendance_record!.file_url, selectedOrder.documents.attendance_record!.file_name)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEditDocument(selectedOrder.id, 'attendance_record')}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => confirmDeleteDocument(selectedOrder.id, 'attendance_record', selectedOrder.documents.attendance_record!.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">No hay planilla de asistencia</p>
                        <Button size="sm" onClick={() => {
                          setUploadType('attendance_record');
                          setIsMultiUpload(false);
                          setIsUploadDialogOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Subir
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Autorización obra social */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">🏥 Autorización Obra Social</h4>
                      {selectedOrder.documents.social_work_authorization ? (
                        <Badge variant="default">Subido</Badge>
                      ) : (
                        <Badge variant="outline">Pendiente</Badge>
                      )}
                    </div>
                    
                    {selectedOrder.documents.social_work_authorization ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm">{selectedOrder.documents.social_work_authorization.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Subido por {selectedOrder.documents.social_work_authorization.uploader_name} - {format(new Date(selectedOrder.documents.social_work_authorization.uploaded_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewDocument(selectedOrder.documents.social_work_authorization!.file_url, selectedOrder.documents.social_work_authorization!.file_name)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(selectedOrder.documents.social_work_authorization!.file_url, selectedOrder.documents.social_work_authorization!.file_name)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEditDocument(selectedOrder.id, 'social_work_authorization')}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => confirmDeleteDocument(selectedOrder.id, 'social_work_authorization', selectedOrder.documents.social_work_authorization!.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">No hay autorización de obra social</p>
                        <Button size="sm" onClick={() => {
                          setUploadType('social_work_authorization');
                          setIsMultiUpload(false);
                          setIsUploadDialogOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-1" />
                          Subir
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Opciones adicionales */}
                  <div className="flex gap-2 pt-4">
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        setIsMultiUpload(true);
                        setSelectedDocumentTypes([]);
                        setIsUploadDialogOpen(true);
                      }}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Subida Múltiple
                    </Button>
                    
                    {getDocumentStatus(selectedOrder).canGeneratePDF && (
                      <Button onClick={() => generatePDF(selectedOrder)} disabled={generatingPdf === selectedOrder.id}>
                        {generatingPdf === selectedOrder.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4 mr-1" />
                        )}
                        {generatingPdf === selectedOrder.id ? 'Generando...' : 'Generar PDF Consolidado'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* DIÁLOGO DE SUBIDA DE ARCHIVOS */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editMode ? 'Editar Documento' : isMultiUpload ? 'Subida Múltiple' : 'Subir Documento'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {isMultiUpload && (
                <div className="space-y-2">
                  <Label>Selecciona los tipos de documento:</Label>
                  <div className="space-y-2">
                    {(['clinical_evolution', 'attendance_record', 'social_work_authorization'] as const).map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={type}
                          checked={selectedDocumentTypes.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDocumentTypes(prev => [...prev, type]);
                            } else {
                              setSelectedDocumentTypes(prev => prev.filter(t => t !== type));
                            }
                          }}
                        />
                        <Label htmlFor={type} className="text-sm">
                          {type === 'clinical_evolution' ? 'Evolución Clínica' :
                           type === 'attendance_record' ? 'Planilla de Asistencia' :
                           'Autorización Obra Social'}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="file">Seleccionar archivo</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && selectedOrder) {
                      if (isMultiUpload && selectedDocumentTypes.length > 0) {
                        handleFileUpload(selectedOrder.id, selectedDocumentTypes, file);
                      } else if (uploadType) {
                        handleSingleFileUpload(selectedOrder.id, uploadType, file);
                      }
                    }
                  }}
                  disabled={!!uploadingDoc}
                />
              </div>
              
              {uploadingDoc && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Subiendo archivo...</span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* VISUALIZADOR DE DOCUMENTOS */}
        <Dialog open={documentViewerOpen} onOpenChange={setDocumentViewerOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Ver Documento: {viewingDocument?.name}</DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 min-h-[500px]">
              {viewingDocument && (
                <iframe
                  src={viewingDocument.url}
                  className="w-full h-[500px] border rounded"
                  title={viewingDocument.name}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* CONFIRMACIÓN DE ELIMINACIÓN */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El documento será eliminado permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (documentToDelete) {
                    handleDeleteDocument(
                      documentToDelete.orderId, 
                      documentToDelete.docType, 
                      documentToDelete.docId
                    );
                  }
                  setDeleteConfirmOpen(false);
                  setDocumentToDelete(null);
                }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
