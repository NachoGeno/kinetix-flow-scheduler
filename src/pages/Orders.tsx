import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, FileText, User, Calendar, Clock, CalendarPlus, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import MedicalOrderForm from '@/components/appointments/MedicalOrderForm';
import AppointmentForm from '@/components/appointments/AppointmentForm';
import MultiSessionAppointmentForm from '@/components/appointments/MultiSessionAppointmentForm';
import PendingDocumentAlert from '@/components/appointments/PendingDocumentAlert';

interface MedicalOrder {
  id: string;
  description: string;
  instructions: string | null;
  order_type: string;
  urgent: boolean;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  art_provider: string | null;
  art_authorization_number: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  document_status: 'pendiente' | 'completa';
  sessions_count?: number;
  patient: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
      dni: string | null;
    };
  };
  doctor: {
    profile: {
      first_name: string;
      last_name: string;
    };
    specialty: {
      name: string;
      color: string;
    };
  };
}

const orderTypeLabels = {
  laboratory: 'Laboratorio',
  imaging: 'Imagenología',
  prescription: 'Prescripción',
  referral: 'Derivación',
};

const orderTypeColors = {
  laboratory: 'bg-blue-100 text-blue-800',
  imaging: 'bg-green-100 text-green-800',
  prescription: 'bg-purple-100 text-purple-800',
  referral: 'bg-orange-100 text-orange-800',
};

export default function Orders() {
  const [orders, setOrders] = useState<MedicalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [isMultiSessionOpen, setIsMultiSessionOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MedicalOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<MedicalOrder | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, [profile]);

  const fetchOrders = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      let query = supabase
        .from('medical_orders')
        .select(`
          *,
          patient:patients(
            id,
            profile:profiles(first_name, last_name, dni)
          ),
          doctor:doctors(
            profile:profiles(first_name, last_name),
            specialty:specialties(name, color)
          )
        `)
        .order('created_at', { ascending: false });

      // Filter based on user role
      if (profile.role === 'doctor') {
        const { data: doctorData } = await supabase
          .from('doctors')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        
        if (doctorData) {
          query = query.eq('doctor_id', doctorData.id);
        }
      }

      const { data, error } = await query;

      if (error) {
        toast({
          title: "Error",
          description: "No se pudieron cargar las órdenes médicas",
          variant: "destructive",
        });
        return;
      }

      setOrders((data || []).map(order => ({
        ...order,
        document_status: (order.document_status as 'pendiente' | 'completa') || 'pendiente'
      })));
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes médicas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewOrderCreated = () => {
    fetchOrders();
    setIsNewOrderOpen(false);
  };

  const handleEditOrder = (order: MedicalOrder) => {
    setEditingOrder(order);
    setIsEditOrderOpen(true);
  };

  const handleOrderUpdated = () => {
    fetchOrders();
    setIsEditOrderOpen(false);
    setEditingOrder(null);
  };

  const handleDownloadFile = async (order: MedicalOrder) => {
    if (!order.attachment_url) return;

    try {
      const { data, error } = await supabase.storage
        .from('medical-orders')
        .download(order.attachment_url);

      if (error) throw error;

      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = order.attachment_name || 'archivo';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    }
  };

  const handleScheduleAppointment = (order: MedicalOrder) => {
    setSelectedOrder(order);
    // Si la orden tiene múltiples sesiones, usar el formulario de múltiples sesiones
    if (order.sessions_count && order.sessions_count > 1) {
      setIsMultiSessionOpen(true);
    } else {
      setIsAppointmentOpen(true);
    }
  };

  const handleAppointmentCreated = () => {
    fetchOrders();
    setIsAppointmentOpen(false);
    setIsMultiSessionOpen(false);
    setSelectedOrder(null);
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('medical_orders')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Orden médica completada",
      });

      fetchOrders();
    } catch (error) {
      console.error('Error completing order:', error);
      toast({
        title: "Error",
        description: "No se pudo completar la orden médica",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('medical_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Orden médica eliminada",
      });

      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la orden médica",
        variant: "destructive",
      });
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.patient?.profile?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.patient?.profile?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.doctor?.profile?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.doctor?.profile?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'completed' && order.completed) ||
                         (statusFilter === 'pending' && !order.completed) ||
                         (statusFilter === 'pending_document' && order.document_status === 'pendiente');
    
    const matchesType = typeFilter === 'all' || order.order_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Órdenes Médicas</h1>
        </div>
        <div className="text-center py-8">Cargando órdenes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Órdenes Médicas</h1>
        <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Orden
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nueva Orden Médica</DialogTitle>
              <DialogDescription>
                Crear una nueva orden médica para un paciente
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <MedicalOrderForm onSuccess={handleNewOrderCreated} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar órdenes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="completed">Completadas</SelectItem>
            <SelectItem value="pending_document">Pendientes de documento</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="laboratory">Laboratorio</SelectItem>
            <SelectItem value="imaging">Imagenología</SelectItem>
            <SelectItem value="prescription">Prescripción</SelectItem>
            <SelectItem value="referral">Derivación</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron órdenes médicas</p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {order.description}
                      {order.urgent && (
                        <Badge variant="destructive" className="text-xs">
                          Urgente
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {order.patient?.profile?.first_name} {order.patient?.profile?.last_name}
                          {order.patient?.profile?.dni && (
                            <span className="text-muted-foreground">
                              (DNI: {order.patient?.profile?.dni})
                            </span>
                          )}
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={orderTypeColors[order.order_type as keyof typeof orderTypeColors]}
                      variant="secondary"
                    >
                      {orderTypeLabels[order.order_type as keyof typeof orderTypeLabels]}
                    </Badge>
                    <Badge 
                      className={order.completed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                      variant="secondary"
                    >
                      {order.completed ? 'Completada' : 'Pendiente'}
                    </Badge>
                    {order.document_status === 'pendiente' && (
                      <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
                        🔴 Sin documento
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
               <CardContent>
                <div className="space-y-3">
                  {order.document_status === 'pendiente' && (
                    <PendingDocumentAlert
                      medicalOrderId={order.id}
                      patientName={`${order.patient?.profile?.first_name} ${order.patient?.profile?.last_name}`}
                      orderDescription={order.description}
                      showUploadButton={false}
                      className="mb-3"
                    />
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Médico:</strong> Dr. {order.doctor?.profile?.first_name} {order.doctor?.profile?.last_name}
                      <br />
                      <span className="text-muted-foreground">{order.doctor?.specialty?.name}</span>
                    </div>
                    <div>
                      <strong>Fecha de creación:</strong>
                      <br />
                      {format(new Date(order.created_at), 'PPP', { locale: es })}
                    </div>
                  </div>

                  {order.instructions && (
                    <div>
                      <strong>Instrucciones:</strong>
                      <p className="text-sm text-muted-foreground mt-1">{order.instructions}</p>
                    </div>
                  )}

                   {(order.art_provider || order.art_authorization_number) && (
                     <div>
                       <strong>ART/Obra Social:</strong>
                       <div className="text-sm text-muted-foreground mt-1">
                         {order.art_provider && <div>Proveedor: {order.art_provider}</div>}
                         {order.art_authorization_number && <div>Autorización: {order.art_authorization_number}</div>}
                       </div>
                     </div>
                   )}

                  {order.attachment_url && (
                    <div>
                      <strong>Archivo adjunto:</strong>
                      <div className="flex items-center gap-2 mt-1">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm text-muted-foreground">{order.attachment_name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadFile(order)}
                          className="h-6 px-2"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {order.completed && order.completed_at && (
                    <div className="text-sm text-green-600">
                      <strong>Completada el:</strong> {format(new Date(order.completed_at), 'PPP', { locale: es })}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScheduleAppointment(order)}
                    >
                      <CalendarPlus className="h-4 w-4 mr-2" />
                      Programar Citas
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditOrder(order)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    
                    {!order.completed && (
                      <Button
                        size="sm"
                        onClick={() => handleCompleteOrder(order.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Completar
                      </Button>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar orden médica?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. La orden médica será eliminada permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteOrder(order.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Order Dialog */}
      <Dialog open={isEditOrderOpen} onOpenChange={setIsEditOrderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Orden Médica</DialogTitle>
            <DialogDescription>
              Modificar la información de la orden médica
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {editingOrder && (
              <MedicalOrderForm 
                editOrder={editingOrder}
                onSuccess={handleOrderUpdated}
                onCancel={() => setIsEditOrderOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-Session Appointment Dialog */}
      <Dialog open={isMultiSessionOpen} onOpenChange={setIsMultiSessionOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Programar Sesiones Múltiples</DialogTitle>
            <DialogDescription>
              Selecciona las fechas y horarios específicos para cada sesión de: {selectedOrder?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <MultiSessionAppointmentForm 
              selectedOrder={selectedOrder}
              onSuccess={handleAppointmentCreated}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Single Appointment Dialog */}
      <Dialog open={isAppointmentOpen} onOpenChange={setIsAppointmentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Programar Cita</DialogTitle>
            <DialogDescription>
              Crear una cita para la orden médica: {selectedOrder?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <AppointmentForm 
              onSuccess={handleAppointmentCreated}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}