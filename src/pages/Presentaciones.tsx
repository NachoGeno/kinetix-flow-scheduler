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
import { usePaginatedPresentations, type PresentationOrder } from "@/hooks/usePaginatedPresentations";
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
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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
  status: 'all' | 'ready' | 'pending' | 'submitted';
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

  // Use the new paginated hook
  const { data: presentationsData, isLoading, refetch } = usePaginatedPresentations({
    searchTerm: filters.search_term,
    obraSocialId: filters.obra_social_id === 'all' ? undefined : filters.obra_social_id,
    professionalId: undefined, // Professional filter needs to be implemented in the DB function
    status: filters.status === 'all' ? undefined : filters.status,
    dateFrom: filters.date_from || undefined,
    dateTo: filters.date_to || undefined,
    page: filters.page,
    limit: 50
  });

  const presentations = presentationsData?.presentations || [];
  const totalCount = presentationsData?.totalCount || 0;
  const totalPages = presentationsData?.totalPages || 1;

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
    setSelectedOrder(presentations.find(p => p.id === orderId) || null);
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

  const refreshPresentationFiles = () => {
    refetch();
  };

  const validateDocumentsForPDF = (order: PresentationOrder) => {
    // With the optimized structure, we use has_documents to check if documents exist
    return order.has_documents && order.sessions_completed;
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

      titlePage.drawText(`Paciente: ${order.patient_name}`, {
        x: 50,
        y: height - 150,
        size: 14,
        font: font,
      });

      titlePage.drawText(`Obra Social: ${order.obra_social_name || 'N/A'}`, {
        x: 50,
        y: height - 180,
        size: 14,
        font: font,
      });

      titlePage.drawText(`Profesional: ${order.professional_name}`, {
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

      titlePage.drawText(`Sesiones: ${order.completed_appointments_count}/${order.total_sessions}`, {
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

      // Add documents
      for (const doc of documents || []) {
        try {
          const docData = await downloadDocument(doc.file_url);
          const docBytes = await docData.arrayBuffer();
          const uint8Array = new Uint8Array(docBytes);
          
          if (doc.file_name.toLowerCase().endsWith('.pdf')) {
            const embeddedPdf = await PDFDocument.load(uint8Array);
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
      a.download = `presentacion_${order.patient_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
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

  const getDocumentStatus = (order: PresentationOrder) => {
    const totalSessions = order.total_sessions || 0;
    const completedSessions = order.completed_appointments_count || 0;
    const hasDocuments = order.has_documents;
    const isOrderCompleted = order.completed;
    const isSessionsCompleted = totalSessions > 0 && completedSessions >= totalSessions;

    // Determinar si las sesiones están completas
    const sessionsCompleted = isOrderCompleted || isSessionsCompleted;

    return {
      sessionsCompleted,
      hasDocuments,
      completedSessions,
      totalSessions,
      documentsCount: order.document_count || 0,
      canGeneratePDF: sessionsCompleted && hasDocuments,
      // Determinar el estado general
      status: sessionsCompleted && hasDocuments ? 'ready' : 
              sessionsCompleted && !hasDocuments ? 'missing-docs' :
              !sessionsCompleted ? 'pending-sessions' : 'pending'
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

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label htmlFor="obra-social">Obra Social</Label>
                <Select 
                  value={filters.obra_social_id} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, obra_social_id: value === "all" ? "" : value, page: 1 }))}
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
                    <SelectItem value="ready">Listo para presentar</SelectItem>
                    <SelectItem value="pending">En preparación</SelectItem>
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
                <Label htmlFor="search">Buscar</Label>
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

        {/* Results Counter and Pagination Info */}
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

        {/* Resultados */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Cargando presentaciones...</p>
            </div>
          ) : presentations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No se encontraron presentaciones</p>
                <p className="text-muted-foreground">Ajusta los filtros para ver más resultados</p>
              </CardContent>
            </Card>
          ) : (
            presentations.map((order) => {
              const status = getDocumentStatus(order);
              const patientName = order.patient_name || 'Sin nombre';
              const professionalName = order.professional_name || 'Sin asignar';
              const obraSocialName = order.obra_social_name || 'Sin obra social';

              return (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{patientName}</CardTitle>
                          {order.urgent && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Urgente
                            </Badge>
                          )}
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
                            {status.completedSessions}/{status.totalSessions} sesiones
                          </Badge>
                        )}

                        {/* Estado de documentos */}
                        {status.hasDocuments ? (
                          <Badge variant="default" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            {status.documentsCount} documentos
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Sin documentos
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
                          {new Date(order.order_date).toLocaleDateString('es-AR')}
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
                            <Download className="h-4 w-4 mr-1" />
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

        {/* Bottom Pagination */}
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

        {/* Document Management Dialog - Simplified for now */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Gestionar Documentos - {selectedOrder?.patient_name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Los documentos de presentación para esta orden médica se gestionan a través del sistema optimizado.
                Para una gestión completa de documentos, use la interfaz específica de cada orden.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium">Estado de Sesiones</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder?.completed_appointments_count || 0}/{selectedOrder?.total_sessions || 0} completadas
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium">Documentos</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder?.document_count || 0} documentos cargados
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Document Viewer Dialog */}
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

        {/* Delete Confirmation Dialog */}
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