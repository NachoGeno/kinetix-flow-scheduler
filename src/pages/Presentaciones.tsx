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
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  const [uploadType, setUploadType] = useState<'clinical_evolution' | 'attendance_record' | null>(null);

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

  const handleFileUpload = async (orderId: string, documentType: 'clinical_evolution' | 'attendance_record', file: File) => {
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

      // Save document record
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
      refetch();
      setIsUploadDialogOpen(false);
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Error al cargar el documento");
    } finally {
      setUploadingDoc(null);
    }
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

  const getDocumentStatus = (order: PresentationOrder) => {
    const docs = order.documents;
    const hasAllDocs = docs.medical_order && docs.clinical_evolution && docs.attendance_record;
    const sessionsReady = order.sessions_completed;
    
    if (!sessionsReady) return { status: 'sessions_pending', color: 'bg-orange-100 text-orange-800', text: 'Sesiones pendientes' };
    if (hasAllDocs && sessionsReady) return { status: 'complete', color: 'bg-green-100 text-green-800', text: 'Completa' };
    return { status: 'incomplete', color: 'bg-red-100 text-red-800', text: 'Incompleta' };
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
                      <span>{order.total_sessions - order.sessions_used} sesiones restantes</span>
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
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs"
                            onClick={() => handleViewDocument(order.documents.clinical_evolution!.file_url)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver evolutivo
                          </Button>
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
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs"
                            onClick={() => handleViewDocument(order.documents.attendance_record!.file_url)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver registro
                          </Button>
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
                  </div>

                  {/* Actions */}
                  {docStatus.status === 'complete' && order.presentation_status !== 'submitted' && (
                    <div className="flex justify-end pt-2 border-t">
                      <Button 
                        onClick={() => markAsSubmitted(order.id)}
                        className="gap-2"
                      >
                        <Send className="h-4 w-4" />
                        Marcar como Enviada
                      </Button>
                    </div>
                  )}
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
              Subir {uploadType === 'clinical_evolution' ? 'Evolutivo Clínico' : 'Registro de Asistencia'}
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
                    handleFileUpload(selectedOrder.id, uploadType, file);
                  }
                }}
                disabled={!!uploadingDoc}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formatos permitidos: PDF, JPG, PNG, DOC, DOCX
              </p>
            </div>
            {uploadingDoc && (
              <p className="text-sm text-blue-600">Subiendo documento...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
