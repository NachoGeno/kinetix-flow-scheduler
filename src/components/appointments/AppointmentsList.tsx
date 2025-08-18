import { useState, useEffect } from 'react';
import { Calendar, Clock, Search, Plus, Filter, Trash2, CheckCircle, UserCheck, UserX, RotateCcw, ArrowRight, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AppointmentForm from './AppointmentForm';
import { useUnifiedMedicalHistory } from '@/hooks/useUnifiedMedicalHistory';
import NoShowOptionsDialog from './NoShowOptionsDialog';
import PatientNoShowAlert from './PatientNoShowAlert';
import ResetNoShowDialog from './ResetNoShowDialog';
import { RescheduleAppointmentDialog } from './RescheduleAppointmentDialog';
import { usePatientNoShowsMultiple } from '@/hooks/usePatientNoShows';
import { usePatientNoShowResets } from '@/hooks/usePatientNoShowResets';

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string;
  patient_id: string;
  doctor_id: string;
  no_show_reason?: string;
  session_deducted?: boolean;
  rescheduled_from_id?: string;
  rescheduled_to_id?: string;
  rescheduled_at?: string;
  rescheduled_by?: string;
  reschedule_reason?: string;
  patient: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
    };
  };
  doctor: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
    };
    specialty: {
      name: string;
      color: string;
    };
  };
  rescheduled_from?: {
    appointment_date: string;
    appointment_time: string;
  } | null;
  rescheduled_to?: {
    appointment_date: string;
    appointment_time: string;
  } | null;
}

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
  no_show_rescheduled: 'bg-orange-100 text-orange-800',
  no_show_session_lost: 'bg-red-100 text-red-800',
  rescheduled: 'bg-purple-100 text-purple-800',
};

const statusLabels = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  in_progress: 'En Progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No Asistió',
  no_show_rescheduled: 'No Asistió - Reprogramado',
  no_show_session_lost: 'No Asistió - Sesión Descontada',
  rescheduled: 'Reprogramado',
};

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [noShowDialogOpen, setNoShowDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedPatientForReset, setSelectedPatientForReset] = useState<{id: string, name: string, noShowCount: number} | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();
  const { createOrUpdateMedicalHistoryEntry } = useUnifiedMedicalHistory();

  // Get unique patient IDs for no-show tracking
  const patientIds = appointments.map(apt => apt.patient_id);
  const { noShowCounts } = usePatientNoShowsMultiple(patientIds);

  // Check if user can reset no-shows
  const canResetNoShows = profile?.role === 'admin' || profile?.role === 'reception';

  useEffect(() => {
    fetchAppointments();
  }, [profile]);

  const fetchAppointments = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(
            id,
            profile:profiles(first_name, last_name)
          ),
          doctor:doctors(
            id,
            profile:profiles(first_name, last_name),
            specialty:specialties(name, color)
          ),
          rescheduled_from:rescheduled_from_id(appointment_date, appointment_time),
          rescheduled_to:rescheduled_to_id(appointment_date, appointment_time)
        `)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      // Filter based on user role
      if (profile.role === 'patient') {
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        
        if (patientData) {
          query = query.eq('patient_id', patientData.id);
        }
      } else if (profile.role === 'doctor') {
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
          description: "No se pudieron cargar las citas",
          variant: "destructive",
        });
        return;
      }

      setAppointments((data || []) as any);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAppointmentCreated = () => {
    fetchAppointments();
    setIsNewAppointmentOpen(false);
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      // Cancelar la cita
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Cita cancelada correctamente",
      });

      fetchAppointments();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la cita",
        variant: "destructive",
      });
    }
  };

  const handleMarkAttendance = async (appointmentId: string, status: 'in_progress') => {
    try {
      // Get the appointment details first
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) {
        throw new Error('Appointment not found');
      }

      // Update appointment status
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId);

      if (error) throw error;

      // Check if there's a medical order for this appointment
      const { data: medicalOrderData, error: orderError } = await supabase
        .from('medical_orders')
        .select('id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (orderError) {
        console.error('Error fetching medical order:', orderError);
      }

      // Create medical history entry
      await createOrUpdateMedicalHistoryEntry(
        appointmentId,
        medicalOrderData?.id || null,
        appointment.patient_id,
        appointment.doctor_id,
        `${appointment.doctor.profile.first_name} ${appointment.doctor.profile.last_name}`,
        appointment.appointment_date
      );

      toast({
        title: "Éxito",
        description: 'Paciente marcado como asistido - Historia clínica unificada creada',
      });

      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la cita",
        variant: "destructive",
      });
    }
  };

  const handleNoShow = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setNoShowDialogOpen(true);
  };

  const handleReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setRescheduleDialogOpen(true);
  };

  const handleResetNoShows = (patientId: string, patientName: string, noShowCount: number) => {
    setSelectedPatientForReset({ id: patientId, name: patientName, noShowCount });
    setResetDialogOpen(true);
  };

  const handleResetSuccess = () => {
    // Refresh appointments and no-show counts
    fetchAppointments();
  };

  const handleNoShowConfirm = async (option: 'reschedule' | 'session_lost', reason?: string) => {
    if (!selectedAppointment) return;

    try {
      const newStatus = option === 'reschedule' ? 'no_show_rescheduled' : 'no_show_session_lost';
      const sessionDeducted = option === 'session_lost';

      // Update appointment status
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: newStatus,
          no_show_reason: reason,
          session_deducted: sessionDeducted
        })
        .eq('id', selectedAppointment.id);

      if (error) throw error;

      // If session is to be deducted, update medical order
      if (sessionDeducted) {
        // Find the medical order for this patient
        const { data: medicalOrderData, error: orderError } = await supabase
          .from('medical_orders')
          .select('id, sessions_used, total_sessions')
          .eq('patient_id', selectedAppointment.patient_id)
          .eq('completed', false)
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (orderError) {
          console.error('Error fetching medical order:', orderError);
        } else if (medicalOrderData) {
          // Increment sessions_used
          const newSessionsUsed = medicalOrderData.sessions_used + 1;
          const isCompleted = newSessionsUsed >= medicalOrderData.total_sessions;

          const { error: updateError } = await supabase
            .from('medical_orders')
            .update({ 
              sessions_used: newSessionsUsed,
              completed: isCompleted,
              completed_at: isCompleted ? new Date().toISOString() : null
            })
            .eq('id', medicalOrderData.id);

          if (updateError) {
            console.error('Error updating medical order:', updateError);
          }
        }
      }

      const optionMessages = {
        reschedule: 'Turno marcado como no asistido - Reprogramado (sesión no descontada)',
        session_lost: 'Turno marcado como no asistido - Sesión descontada de la orden médica'
      };

      toast({
        title: "Éxito",
        description: optionMessages[option],
      });

      fetchAppointments();
    } catch (error) {
      console.error('Error handling no-show:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la inasistencia",
        variant: "destructive",
      });
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = appointment.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.patient?.profile?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.patient?.profile?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.doctor?.profile?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.doctor?.profile?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Citas Médicas</h1>
        </div>
        <div className="text-center py-8">Cargando citas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Lista de Citas</h1>
        {profile?.role === 'patient' && (
          <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Cita
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Agendar Nueva Cita</DialogTitle>
              </DialogHeader>
              <AppointmentForm onSuccess={handleAppointmentCreated} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar citas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="scheduled">Programada</SelectItem>
            <SelectItem value="confirmed">Confirmada</SelectItem>
            <SelectItem value="in_progress">En Progreso</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
            <SelectItem value="no_show">No Asistió</SelectItem>
            <SelectItem value="no_show_rescheduled">No Asistió - Reprogramado</SelectItem>
            <SelectItem value="no_show_session_lost">No Asistió - Sesión Descontada</SelectItem>
            <SelectItem value="rescheduled">Reprogramado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Appointments List */}
      <div className="grid gap-4">
        {filteredAppointments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron citas</p>
            </CardContent>
          </Card>
        ) : (
          filteredAppointments.map((appointment) => {
            const patientName = `${appointment.patient?.profile?.first_name} ${appointment.patient?.profile?.last_name}`;
            const patientNoShowCount = noShowCounts[appointment.patient_id] || 0;
            
            return (
            <Card key={appointment.id} className="hover:shadow-md transition-shadow">
              {/* No-show alert */}
              {patientNoShowCount >= 2 && (
                <div className="px-6 pt-4">
                  <PatientNoShowAlert 
                    noShowCount={patientNoShowCount}
                    patientName={patientName}
                    patientId={appointment.patient_id}
                    variant="default"
                    canReset={canResetNoShows}
                    onResetClick={() => handleResetNoShows(appointment.patient_id, patientName, patientNoShowCount)}
                  />
                </div>
              )}
              <CardHeader className={`pb-2 ${patientNoShowCount >= 2 ? 'pt-2' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {profile?.role === 'patient' 
                        ? `Dr. ${appointment.doctor?.profile?.first_name} ${appointment.doctor?.profile?.last_name}`
                        : patientName
                      }
                      {patientNoShowCount >= 2 && (
                        <PatientNoShowAlert 
                          noShowCount={patientNoShowCount}
                          patientName={patientName}
                          patientId={appointment.patient_id}
                          variant="compact"
                        />
                      )}
                    </CardTitle>
                    <CardDescription>
                      {appointment.doctor?.specialty?.name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={statusColors[appointment.status as keyof typeof statusColors]}
                      variant="secondary"
                    >
                      {statusLabels[appointment.status as keyof typeof statusLabels]}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {/* Botones de asistencia para doctores y admins */}
                      {(profile?.role === 'doctor' || profile?.role === 'admin') && 
                       appointment.status === 'scheduled' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-green-600 hover:text-green-700"
                            onClick={() => handleMarkAttendance(appointment.id, 'in_progress')}
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            Asistió
                          </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             className="h-8 px-2 text-gray-600 hover:text-gray-700"
                             onClick={() => handleNoShow(appointment)}
                           >
                             <UserX className="h-3 w-3 mr-1" />
                             No asistió
                           </Button>
                        </>
                       )}
                       
                       {/* Botón reprogramar - para admin/doctor y estados específicos */}
                       {(profile?.role === 'doctor' || profile?.role === 'admin') && 
                        (appointment.status === 'scheduled' || appointment.status === 'confirmed' || 
                         appointment.status === 'no_show' || appointment.status === 'no_show_rescheduled') && (
                         <Button
                           variant="outline"
                           size="sm"
                           className="h-8 px-2 text-purple-600 hover:text-purple-700"
                           onClick={() => handleReschedule(appointment)}
                         >
                           <RotateCcw className="h-3 w-3 mr-1" />
                           Reprogramar
                         </Button>
                       )}
                      
                      {/* Botón cancelar */}
                      {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Cancelar cita?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción cancelará la cita programada. El horario quedará disponible para otros pacientes. ¿Estás seguro de que deseas continuar?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleCancelAppointment(appointment.id)}
                              >
                                Sí, cancelar cita
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {format(new Date(appointment.appointment_date), 'PPP', { locale: es })}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {appointment.appointment_time}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: appointment.doctor?.specialty?.color }}
                    />
                    <span className="text-sm">
                      {appointment.doctor?.specialty?.name}
                    </span>
                  </div>
                </div>
                 {appointment.reason && (
                   <p className="text-sm text-muted-foreground mt-2">
                     <strong>Motivo:</strong> {appointment.reason}
                   </p>
                 )}
                 {appointment.no_show_reason && (
                   <p className="text-sm text-muted-foreground mt-2">
                     <strong>Observaciones de inasistencia:</strong> {appointment.no_show_reason}
                   </p>
                 )}
                 {appointment.session_deducted && (
                   <p className="text-sm text-red-600 mt-2">
                     <strong>Sesión descontada de la orden médica</strong>
                   </p>
                  )}
                  
                  {/* Rescheduling traceability */}
                  {appointment.rescheduled_from && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                      <Info className="h-4 w-4 text-purple-600" />
                      <p className="text-sm text-purple-800">
                        <strong>Turno generado por reprogramación</strong> del {format(new Date(appointment.rescheduled_from.appointment_date), 'dd/MM/yyyy')} a las {appointment.rescheduled_from.appointment_time}
                      </p>
                    </div>
                  )}
                  
                  {appointment.rescheduled_to && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <ArrowRight className="h-4 w-4 text-amber-600" />
                      <p className="text-sm text-amber-800">
                        <strong>Este turno fue reprogramado</strong> el {appointment.rescheduled_at ? format(new Date(appointment.rescheduled_at), 'dd/MM/yyyy \'a las\' HH:mm') : ''} → Nuevo turno: {format(new Date(appointment.rescheduled_to.appointment_date), 'dd/MM/yyyy')} a las {appointment.rescheduled_to.appointment_time}
                      </p>
                    </div>
                  )}
                  
                  {appointment.reschedule_reason && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <strong>Motivo de reprogramación:</strong> {appointment.reschedule_reason}
                    </p>
                  )}
              </CardContent>
            </Card>
            );
          })
        )}
      </div>

      {/* No Show Options Dialog */}
      <NoShowOptionsDialog
        open={noShowDialogOpen}
        onClose={() => {
          setNoShowDialogOpen(false);
          setSelectedAppointment(null);
        }}
        onConfirm={handleNoShowConfirm}
        patientName={selectedAppointment ? `${selectedAppointment.patient.profile.first_name} ${selectedAppointment.patient.profile.last_name}` : ''}
      />

      {/* Reset No Show Dialog */}
      <ResetNoShowDialog
        open={resetDialogOpen}
        onClose={() => {
          setResetDialogOpen(false);
          setSelectedPatientForReset(null);
        }}
        onSuccess={handleResetSuccess}
        patientId={selectedPatientForReset?.id || ''}
        patientName={selectedPatientForReset?.name || ''}
        currentNoShowCount={selectedPatientForReset?.noShowCount || 0}
      />

      {/* Reschedule Appointment Dialog */}
      {selectedAppointment && (
        <RescheduleAppointmentDialog
          open={rescheduleDialogOpen}
          onOpenChange={setRescheduleDialogOpen}
          appointment={selectedAppointment}
          onSuccess={() => {
            fetchAppointments();
            setRescheduleDialogOpen(false);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
}