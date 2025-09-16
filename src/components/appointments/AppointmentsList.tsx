import { useState } from 'react';
import { Calendar, Clock, Search, Filter, Trash2, CheckCircle, UserCheck, UserX, RotateCcw, ArrowRight, Info, Edit, CalendarIcon, X, LogOut, Undo2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, isBefore, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatDateToISO } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { usePaginatedAppointments } from '@/hooks/usePaginatedAppointments';
import AppointmentForm from './AppointmentForm';
import { useUnifiedMedicalHistory } from '@/hooks/useUnifiedMedicalHistory';
import NoShowOptionsDialog from './NoShowOptionsDialog';
import PatientNoShowAlert from './PatientNoShowAlert';
import ResetNoShowDialog from './ResetNoShowDialog';
import { RescheduleAppointmentDialog } from './RescheduleAppointmentDialog';
import EditAppointmentDialog from './EditAppointmentDialog';
import DischargePatientDialog from './DischargePatientDialog';
import UndoAppointmentDialog from './UndoAppointmentDialog';
import { usePatientNoShowsMultiple } from '@/hooks/usePatientNoShows';
import { usePatientNoShowResets } from '@/hooks/usePatientNoShowResets';
import { useCanUndoAppointment } from '@/hooks/useAppointmentHistory';

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string;
  notes?: string;
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
    } | null;
  } | null;
  doctor: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
    } | null;
    specialty: {
      name: string;
      color: string;
    } | null;
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
  no_show_session_lost: 'bg-amber-100 text-amber-800',
  rescheduled: 'bg-purple-100 text-purple-800',
  discharged: 'bg-cyan-100 text-cyan-800',
};

const statusLabels = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  in_progress: 'En Progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'Ausente',
  no_show_rescheduled: 'Ausente - Reprogramado',
  no_show_session_lost: 'Ausente',
  rescheduled: 'Reprogramado',
  discharged: 'Alta Temprana',
};

export default function AppointmentsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDateFrom, setSelectedDateFrom] = useState<Date | undefined>(undefined);
  const [selectedDateTo, setSelectedDateTo] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showNoShowDialog, setShowNoShowDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDischargeDialog, setShowDischargeDialog] = useState(false);
  const [patientToDischarge, setPatientToDischarge] = useState<{ 
    patientId: string; 
    patientName: string;
    totalSessions: number;
    usedSessions: number;
    futureAppointments: Array<{
      id: string;
      appointment_date: string;
      appointment_time: string;
      doctor_name: string;
    }>;
    medicalOrderId: string;
  } | null>(null);
  const [isLoadingDischargeData, setIsLoadingDischargeData] = useState(false);
  const [showResetNoShowDialog, setShowResetNoShowDialog] = useState(false);
  const [patientToReset, setPatientToReset] = useState<{ patientId: string; patientName: string } | null>(null);
  const [undoAppointment, setUndoAppointment] = useState<Appointment | null>(null);
  
  const { profile } = useAuth();
  const { toast } = useToast();
  const { createOrUpdateMedicalHistoryEntry } = useUnifiedMedicalHistory();

  // Function to fetch patient discharge data
  const fetchPatientDischargeData = async (patientId: string, patientName: string) => {
    setIsLoadingDischargeData(true);
    try {
      // Get active medical orders
      const { data: medicalOrders, error: orderError } = await supabase
        .from('medical_orders')
        .select('id, total_sessions, sessions_used')
        .eq('patient_id', patientId)
        .eq('completed', false)
        .order('created_at', { ascending: false });

      const medicalOrder = medicalOrders?.[0]; // Get the most recent active order

      if (orderError) {
        console.error('Error fetching medical order:', orderError);
        toast({
          title: "Error",
          description: 'Error al cargar información del paciente',
          variant: "destructive",
        });
        return;
      }

      if (!medicalOrder) {
        toast({
          title: "Error", 
          description: 'No se encontró orden médica activa para este paciente',
          variant: "destructive",
        });
        return;
      }

      // Get future appointments
      const { data: futureAppointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          doctor:doctors(
            profile:profiles(first_name, last_name)
          )
        `)
        .eq('patient_id', patientId)
        .in('status', ['scheduled', 'confirmed', 'in_progress'])
        .gte('appointment_date', new Date().toISOString().split('T')[0])
        .order('appointment_date');

      if (appointmentsError) {
        console.error('Error fetching future appointments:', appointmentsError);
      }

      const formattedFutureAppointments = (futureAppointments || []).map((apt: any) => ({
        id: apt.id,
        appointment_date: apt.appointment_date,
        appointment_time: apt.appointment_time,
        doctor_name: apt.doctor?.profile ? 
          `${apt.doctor.profile.first_name} ${apt.doctor.profile.last_name}` : 
          'Doctor no asignado'
      }));

      setPatientToDischarge({
        patientId,
        patientName,
        totalSessions: medicalOrder.total_sessions,
        usedSessions: medicalOrder.sessions_used,
        futureAppointments: formattedFutureAppointments,
        medicalOrderId: medicalOrder.id
      });
      setShowDischargeDialog(true);
    } catch (error) {
      console.error('Error fetching patient discharge data:', error);
      toast({
        title: "Error",
        description: 'Error al cargar datos del paciente',
        variant: "destructive",
      });
    } finally {
      setIsLoadingDischargeData(false);
    }
  };

  // Debounce search term to avoid excessive API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  const pageSize = 50;

  // Use paginated appointments hook
  const { 
    data: appointmentsData, 
    isLoading,
    refetch: refetchAppointments 
  } = usePaginatedAppointments({
    searchTerm: debouncedSearchTerm,
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    dateFrom: selectedDateFrom ? formatDateToISO(selectedDateFrom) : undefined,
    dateTo: selectedDateTo ? formatDateToISO(selectedDateTo) : undefined,
    page: currentPage,
    limit: pageSize
  });

  const appointments = appointmentsData?.appointments || [];
  const totalPages = appointmentsData?.totalPages || 0;
  const totalCount = appointmentsData?.totalCount || 0;

  // Get unique patient IDs for no-show tracking
  const patientIds = appointments.map(apt => apt.patient_id);
  const { noShowCounts } = usePatientNoShowsMultiple(patientIds);

  // Check if user can reset no-shows
  const canResetNoShows = profile?.role === 'admin' || profile?.role === 'reception';


  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Cita cancelada correctamente",
      });

      refetchAppointments();
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
    if (!profile) return;

    try {
      console.log('🔍 Intentando marcar presente turno:', appointmentId, 'con usuario:', profile.id, 'rol:', profile.role);
      
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ 
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (appointmentError) {
        console.error('❌ Error actualizando appointment:', appointmentError);
        throw appointmentError;
      }

      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment) throw new Error('Appointment not found');

      const { data: medicalOrderData, error: orderError } = await supabase
        .from('medical_orders')
        .select('id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (orderError) {
        console.error('Error fetching medical order:', orderError);
      }

      await createOrUpdateMedicalHistoryEntry(
        appointmentId,
        medicalOrderData?.id || null,
        appointment.patient_id,
        appointment.doctor_id,
        `${appointment.doctor?.profile?.first_name || 'Doctor'} ${appointment.doctor?.profile?.last_name || 'no asignado'}`,
        appointment.appointment_date
      );

      toast({
        title: "Éxito",
        description: 'Paciente marcado como asistido - Historia clínica unificada creada',
      });

      refetchAppointments();
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
    setShowNoShowDialog(true);
  };

  const handleReschedule = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowRescheduleDialog(true);
  };

  const handleEdit = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowEditDialog(true);
  };

  const handleNoShowConfirm = async (option: 'reschedule' | 'session_lost', reason?: string) => {
    if (!selectedAppointment) return;

    try {
      const newStatus = option === 'reschedule' ? 'no_show_rescheduled' : 'no_show_session_lost';
      const sessionDeducted = option === 'session_lost';

      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: newStatus,
          no_show_reason: reason,
          session_deducted: sessionDeducted
        })
        .eq('id', selectedAppointment.id);

      if (error) throw error;

      if (sessionDeducted) {
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

      refetchAppointments();
    } catch (error) {
      console.error('Error handling no-show:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la inasistencia",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <TooltipProvider>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Lista de Citas</h1>
          </div>
          <div className="text-center py-8">Cargando citas...</div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Lista de Citas</h1>
            <p className="text-muted-foreground">
              {totalCount} citas encontradas
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Status Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por paciente, doctor o motivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="scheduled">Programada</SelectItem>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="no_show">Ausente</SelectItem>
                  <SelectItem value="no_show_rescheduled">Ausente - Reprogramado</SelectItem>
                  <SelectItem value="no_show_session_lost">Ausente - Sesión Descontada</SelectItem>
                  <SelectItem value="rescheduled">Reprogramado</SelectItem>
                  <SelectItem value="discharged">Alta Temprana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Desde</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDateFrom ? format(selectedDateFrom, "PPP", { locale: es }) : "Fecha inicio"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDateFrom}
                      onSelect={setSelectedDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Hasta</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDateTo ? format(selectedDateTo, "PPP", { locale: es }) : "Fecha fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDateTo}
                      onSelect={setSelectedDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Clear Filters */}
            {(searchTerm || selectedStatus !== 'all' || selectedDateFrom || selectedDateTo) && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedStatus('all');
                    setSelectedDateFrom(undefined);
                    setSelectedDateTo(undefined);
                    setCurrentPage(1);
                  }}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appointments List */}
        <div className="grid gap-4">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No se encontraron citas</p>
              </CardContent>
            </Card>
          ) : (
            appointments.map((appointment) => {
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
                      onResetClick={() => {
                        setPatientToReset({ patientId: appointment.patient_id, patientName });
                        setShowResetNoShowDialog(true);
                      }}
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
                         {/* Action buttons */}
                          {(profile?.role === 'doctor' || profile?.role === 'admin' || profile?.role === 'reception') && 
                           appointment.status === 'scheduled' && (
                           <>
                             <Tooltip>
                               <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                     onClick={() => {
                                       console.log('🎯 Intentando marcar presente:', appointment.patient?.profile?.first_name || 'N/A', appointment.patient?.profile?.last_name || 'N/A', appointment.appointment_date, appointment.appointment_time);
                                       handleMarkAttendance(appointment.id, 'in_progress');
                                     }}
                                  >
                                   <UserCheck className="h-4 w-4" />
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent>
                                 <p>Marcar como asistido</p>
                               </TooltipContent>
                             </Tooltip>
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700"
                                   onClick={() => handleNoShow(appointment)}
                                 >
                                   <UserX className="h-4 w-4" />
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent>
                                 <p>Marcar como ausente</p>
                               </TooltipContent>
                             </Tooltip>
                           </>
                         )}

                         {/* Reschedule button */}
                         {(profile?.role === 'doctor' || profile?.role === 'admin') && 
                          appointment.status !== 'cancelled' && 
                          appointment.status !== 'completed' && 
                          appointment.status !== 'discharged' && (
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                 onClick={() => handleReschedule(appointment)}
                               >
                                 <RotateCcw className="h-4 w-4" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent>
                               <p>Reprogramar cita</p>
                             </TooltipContent>
                           </Tooltip>
                         )}

                         {/* Early discharge button */}
                         {(profile?.role === 'doctor' || profile?.role === 'admin') && 
                          (appointment.status === 'in_progress' || appointment.status === 'completed') && (
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 className="h-8 w-8 p-0 text-cyan-600 hover:text-cyan-700"
                                   onClick={() => fetchPatientDischargeData(
                                     appointment.patient_id,
                                     `${appointment.patient?.profile?.first_name || 'N/A'} ${appointment.patient?.profile?.last_name || ''}`
                                   )}
                                  disabled={isLoadingDischargeData}
                               >
                                 <LogOut className="h-4 w-4" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent>
                               <p>Alta temprana</p>
                             </TooltipContent>
                           </Tooltip>
                         )}
                         
                         {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Cancelar cita</p>
                              </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Cancelar cita?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción cancelará la cita programada. ¿Estás seguro?
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

                          {/* Undo Button */}
                          <UndoButton appointment={appointment} onUndo={setUndoAppointment} />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(appointment.appointment_date + 'T00:00:00'), 'PPP', { locale: es })}
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
                </CardContent>
              </Card>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationPrevious 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNumber = Math.max(1, currentPage - 2) + i;
                if (pageNumber > totalPages) return null;
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNumber)}
                      isActive={currentPage === pageNumber}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationNext 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationContent>
          </Pagination>
        )}

        {/* Dialogs */}
        <NoShowOptionsDialog
          open={showNoShowDialog}
          onClose={() => {
            setShowNoShowDialog(false);
            setSelectedAppointment(null);
          }}
          onConfirm={handleNoShowConfirm}
          patientName={selectedAppointment ? `${selectedAppointment.patient?.profile?.first_name || 'N/A'} ${selectedAppointment.patient?.profile?.last_name || ''}` : ''}
        />

        <ResetNoShowDialog
          open={showResetNoShowDialog}
          onClose={() => {
            setShowResetNoShowDialog(false);
            setPatientToReset(null);
          }}
          onSuccess={() => refetchAppointments()}
          patientId={patientToReset?.patientId || ''}
          patientName={patientToReset?.patientName || ''}
          currentNoShowCount={0}
        />

        {selectedAppointment && (
          <>
            <EditAppointmentDialog
              open={showEditDialog}
              onOpenChange={(open) => {
                setShowEditDialog(open);
                if (!open) setSelectedAppointment(null);
              }}
              appointment={selectedAppointment}
              onSuccess={() => {
                refetchAppointments();
                setShowEditDialog(false);
                setSelectedAppointment(null);
              }}
            />

            <RescheduleAppointmentDialog
              open={showRescheduleDialog}
              onOpenChange={setShowRescheduleDialog}
              appointment={selectedAppointment}
              onSuccess={() => {
                refetchAppointments();
                setShowRescheduleDialog(false);
                setSelectedAppointment(null);
              }}
            />
          </>
        )}

        {patientToDischarge && (
          <DischargePatientDialog
            open={showDischargeDialog}
            onOpenChange={(open) => {
              setShowDischargeDialog(open);
              if (!open) setPatientToDischarge(null);
            }}
            patientInfo={{
              id: patientToDischarge.patientId,
              name: patientToDischarge.patientName,
              totalSessions: patientToDischarge.totalSessions,
              usedSessions: patientToDischarge.usedSessions,
              futureAppointments: patientToDischarge.futureAppointments,
              medicalOrderId: patientToDischarge.medicalOrderId,
            }}
            onSuccess={() => {
              refetchAppointments();
              setShowDischargeDialog(false);
              setPatientToDischarge(null);
            }}
          />
        )}

        {undoAppointment && (
          <UndoAppointmentDialog
            isOpen={true}
            onClose={() => setUndoAppointment(null)}
            appointment={undoAppointment}
            onSuccess={() => {
              refetchAppointments();
              setUndoAppointment(null);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// Separate component for the undo button to manage its own state and logic
function UndoButton({ appointment, onUndo }: { 
  appointment: Appointment; 
  onUndo: (appointment: Appointment) => void; 
}) {
  const { profile } = useAuth();
  const canUndo = useCanUndoAppointment(appointment.id);
  
  // Only show for admin/reception and for certain statuses within 24 hours
  const shouldShowUndo = (profile?.role === 'admin' || profile?.role === 'reception') && 
    canUndo && 
    ['completed', 'no_show', 'no_show_session_lost', 'cancelled'].includes(appointment.status);
  
  if (!shouldShowUndo) return null;
  
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => onUndo(appointment)}
      className="text-muted-foreground hover:text-foreground"
      title="Deshacer acción (disponible por 24 horas)"
    >
      <Undo2 className="h-3 w-3 mr-1" />
      Deshacer
    </Button>
  );
}