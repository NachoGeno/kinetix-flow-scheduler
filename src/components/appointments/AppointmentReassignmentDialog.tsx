import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarDays, Clock, User, FileText, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useOrderAssignments } from '@/hooks/useOrderAssignments';
import { useToast } from '@/hooks/use-toast';

interface CompletedAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  doctor: {
    profile: {
      first_name: string;
      last_name: string;
    };
  };
  assignment: {
    medical_order_id: string;
    medical_order: {
      description: string;
    };
  } | null;
}

interface MedicalOrder {
  id: string;
  description: string;
  total_sessions: number;
  sessions_used: number;
  completed: boolean;
  order_date: string;
  doctor_name: string | null;
}

interface AppointmentReassignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string | null;
  patientName: string;
  onReassignmentComplete: () => void;
}

export default function AppointmentReassignmentDialog({
  isOpen,
  onClose,
  patientId,
  patientName,
  onReassignmentComplete,
}: AppointmentReassignmentDialogProps) {
  const [completedAppointments, setCompletedAppointments] = useState<CompletedAppointment[]>([]);
  const [medicalOrders, setMedicalOrders] = useState<MedicalOrder[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  const {
    getCompletedAppointmentsForPatient,
    getPatientMedicalOrders,
    reassignAppointment,
    removeAssignment,
  } = useOrderAssignments();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && patientId) {
      fetchData();
    }
  }, [isOpen, patientId]);

  const fetchData = async () => {
    if (!patientId) return;

    try {
      setLoading(true);
      const [appointments, orders] = await Promise.all([
        getCompletedAppointmentsForPatient(patientId),
        getPatientMedicalOrders(patientId),
      ]);

      setCompletedAppointments(appointments);
      setMedicalOrders(orders);
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedAppointment) {
      toast({
        title: "Error",
        description: "Selecciona una cita para reasignar",
        variant: "destructive",
      });
      return;
    }

    try {
      setReassigning(true);

      let success = false;
      if (selectedOrder === 'none') {
        success = await removeAssignment(selectedAppointment);
      } else if (selectedOrder) {
        success = await reassignAppointment(selectedAppointment, selectedOrder);
      }

      if (success) {
        await fetchData(); // Refresh data
        setSelectedAppointment('');
        setSelectedOrder('');
        onReassignmentComplete();
        toast({
          title: "Éxito",
          description: "Cita reasignada correctamente",
        });
      }
    } finally {
      setReassigning(false);
    }
  };

  const getSelectedAppointment = () => {
    return completedAppointments.find(apt => apt.id === selectedAppointment);
  };

  const getCurrentAssignment = () => {
    const appointment = getSelectedAppointment();
    return appointment?.assignment;
  };

  const getSelectedOrderData = () => {
    if (selectedOrder === 'none') return null;
    return medicalOrders.find(order => order.id === selectedOrder);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Reasignar Citas Completadas</DialogTitle>
          <DialogDescription>
            Reasigna citas completadas de <strong>{patientName}</strong> a diferentes órdenes médicas
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Cargando datos...</div>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6">
              {/* Step 1: Select Appointment */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">1. Seleccionar Cita Completada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedAppointment} onValueChange={setSelectedAppointment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cita completada" />
                    </SelectTrigger>
                    <SelectContent>
                      {completedAppointments.map((appointment) => (
                        <SelectItem key={appointment.id} value={appointment.id}>
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            <span>
                              {format(new Date(appointment.appointment_date), 'dd/MM/yyyy', { locale: es })}
                            </span>
                            <Clock className="h-4 w-4" />
                            <span>{appointment.appointment_time.substring(0, 5)}</span>
                            <User className="h-4 w-4" />
                            <span>
                              Dr. {appointment.doctor.profile.first_name} {appointment.doctor.profile.last_name}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {getCurrentAssignment() && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">
                            Asignación actual:
                          </p>
                          <p className="text-sm text-blue-700">
                            {getCurrentAssignment()?.medical_order.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedAppointment && !getCurrentAssignment() && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-orange-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-orange-800">
                            Sin asignación específica
                          </p>
                          <p className="text-sm text-orange-700">
                            Esta cita se está contabilizando por FIFO (orden más antigua)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 2: Select Target Order */}
              {selectedAppointment && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">2. Asignar a Orden Médica</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar orden médica de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <div className="flex items-center gap-2">
                            <span>Sin asignación (usar FIFO)</span>
                            <Badge variant="outline">Automático</Badge>
                          </div>
                        </SelectItem>
                        {medicalOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            <div className="flex items-center justify-between w-full">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {order.description.substring(0, 50)}
                                  {order.description.length > 50 ? '...' : ''}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {order.sessions_used}/{order.total_sessions} sesiones
                                  {order.doctor_name && ` • Dr. ${order.doctor_name}`}
                                </p>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Visual representation of change */}
                    {selectedOrder && (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-500 mb-1">DE:</p>
                            <p className="text-sm">
                              {getCurrentAssignment()?.medical_order.description || 'Sin asignación (FIFO)'}
                            </p>
                          </div>
                          
                          <ArrowRight className="h-5 w-5 text-gray-400 mx-4" />
                          
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-500 mb-1">A:</p>
                            <p className="text-sm">
                              {selectedOrder === 'none' 
                                ? 'Sin asignación (FIFO)' 
                                : getSelectedOrderData()?.description || 'Orden seleccionada'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleReassign}
                  disabled={!selectedAppointment || !selectedOrder || reassigning}
                >
                  {reassigning ? 'Reasignando...' : 'Reasignar Cita'}
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}