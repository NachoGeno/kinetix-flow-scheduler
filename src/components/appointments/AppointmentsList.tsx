import { useState, useEffect } from 'react';
import { Calendar, Clock, Search, Plus, Filter, Trash2, CheckCircle, UserCheck, UserX, RotateCcw, ArrowRight, Info, Edit, CalendarIcon, X, LogOut } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isAfter, isBefore, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import AppointmentForm from './AppointmentForm';
import { useUnifiedMedicalHistory } from '@/hooks/useUnifiedMedicalHistory';
import NoShowOptionsDialog from './NoShowOptionsDialog';
import PatientNoShowAlert from './PatientNoShowAlert';
import ResetNoShowDialog from './ResetNoShowDialog';
import { RescheduleAppointmentDialog } from './RescheduleAppointmentDialog';
import EditAppointmentDialog from './EditAppointmentDialog';
import DischargePatientDialog from './DischargePatientDialog';
import { usePatientNoShowsMultiple } from '@/hooks/usePatientNoShows';
import { usePatientNoShowResets } from '@/hooks/usePatientNoShowResets';

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
  no_show_session_lost: 'Ausente - Sesión Descontada',
  rescheduled: 'Reprogramado',
  discharged: 'Alta Temprana',
};

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [dateRangeStart, setDateRangeStart] = useState<Date | undefined>(undefined);
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | undefined>(undefined);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [noShowDialogOpen, setNoShowDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [dischargeDialogOpen, setDischargeDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [patientToDischarge, setPatientToDischarge] = useState<any>(null);
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
    if (!profile) return;

    try {
      // Update appointment status
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ 
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (appointmentError) throw appointmentError;

      // Find the appointment to get its details
      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment) throw new Error('Appointment not found');

      // Get medical order associated with this appointment
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

  const handleRevertAttendance = async (appointmentId: string) => {
    if (!profile) return;

    try {
      // Find the appointment to get its details
      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment) throw new Error('Appointment not found');

      // Update appointment status back to confirmed
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (appointmentError) throw appointmentError;

      // Add reversal note to medical history entry if it exists
      const { data: medicalOrderData } = await supabase
        .from('medical_orders')
        .select('id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (medicalOrderData?.id) {
        // Find existing medical history entry for this appointment
        const { data: historyEntry } = await supabase
          .from('medical_history_entries')
          .select('*')
          .eq('appointment_id', appointmentId)
          .maybeSingle();

        if (historyEntry) {
          // Add reversal note to existing observations
          const revertNote = `\n\n[REVERSIÓN] Asistencia revertida el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })} por ${profile.first_name} ${profile.last_name}. Motivo: Corrección de error de marcado.`;
          
          await supabase
            .from('medical_history_entries')
            .update({
              observations: (historyEntry.observations || '') + revertNote,
              updated_at: new Date().toISOString()
            })
            .eq('id', historyEntry.id);
        }
      }

      toast({
        title: "Éxito",
        description: 'Asistencia revertida correctamente',
      });

      fetchAppointments();
    } catch (error) {
      console.error('Error reverting attendance:', error);
      toast({
        title: "Error",
        description: "No se pudo revertir la asistencia",
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

  const handleEdit = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setEditDialogOpen(true);
  };

  const handleDischarge = async (patientId: string) => {
    try {
      // Obtener información del paciente y sus citas futuras
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select(`
          id,
          profile:profiles(first_name, last_name)
        `)
        .eq('id', patientId)
        .single();

      if (patientError || !patientData) throw patientError;

      // Obtener orden médica activa
      const { data: medicalOrder, error: orderError } = await supabase
        .from('medical_orders')
        .select('id, total_sessions, sessions_used')
        .eq('patient_id', patientId)
        .eq('completed', false)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (orderError) throw orderError;
      if (!medicalOrder) {
        toast({
          title: "Error",
          description: "No se encontró una orden médica activa para este paciente",
          variant: "destructive",
        });
        return;
      }

      // Obtener citas futuras
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
        .in('status', ['scheduled', 'confirmed'])
        .gte('appointment_date', new Date().toISOString().split('T')[0])
        .order('appointment_date', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      const patientInfo = {
        id: patientId,
        name: `${patientData.profile.first_name} ${patientData.profile.last_name}`,
        totalSessions: medicalOrder.total_sessions,
        usedSessions: medicalOrder.sessions_used,
        futureAppointments: (futureAppointments || []).map(apt => ({
          id: apt.id,
          appointment_date: apt.appointment_date,
          appointment_time: apt.appointment_time,
          doctor_name: `Dr. ${apt.doctor.profile.first_name} ${apt.doctor.profile.last_name}`
        })),
        medicalOrderId: medicalOrder.id
      };

      setPatientToDischarge(patientInfo);
      setDischargeDialogOpen(true);
    } catch (error) {
      console.error('Error preparing discharge:', error);
      toast({
        title: "Error",
        description: "No se pudo preparar el alta del paciente",
        variant: "destructive",
      });
    }
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
    
    // Date filtering
    let matchesDate = true;
    if (dateFilter) {
      const appointmentDate = parseISO(appointment.appointment_date);
      matchesDate = isSameDay(appointmentDate, dateFilter);
    } else if (dateRangeStart && dateRangeEnd) {
      const appointmentDate = parseISO(appointment.appointment_date);
      matchesDate = (isSameDay(appointmentDate, dateRangeStart) || isAfter(appointmentDate, dateRangeStart)) &&
                    (isSameDay(appointmentDate, dateRangeEnd) || isBefore(appointmentDate, dateRangeEnd));
    } else if (dateRangeStart) {
      const appointmentDate = parseISO(appointment.appointment_date);
      matchesDate = isSameDay(appointmentDate, dateRangeStart) || isAfter(appointmentDate, dateRangeStart);
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <TooltipProvider>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Citas Médicas</h1>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            {/* Single Date Filter */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Fecha específica</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFilter && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter ? format(dateFilter, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date Range Filters */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Desde</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRangeStart && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeStart ? format(dateRangeStart, "PPP", { locale: es }) : "Fecha inicio"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateRangeStart}
                    onSelect={setDateRangeStart}
                    initialFocus
                    className="pointer-events-auto"
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
                      !dateRangeEnd && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeEnd ? format(dateRangeEnd, "PPP", { locale: es }) : "Fecha fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateRangeEnd}
                    onSelect={setDateRangeEnd}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Clear Filters */}
          {(searchTerm || statusFilter !== 'all' || dateFilter || dateRangeStart || dateRangeEnd) && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setDateFilter(undefined);
                  setDateRangeStart(undefined);
                  setDateRangeEnd(undefined);
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
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                 onClick={() => handleMarkAttendance(appointment.id, 'in_progress')}
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
                        
                        {/* Botón Revertir Asistencia - solo para in_progress */}
                        {(profile?.role === 'doctor' || profile?.role === 'admin' || profile?.role === 'reception') && 
                         appointment.status === 'in_progress' && (
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Revertir asistencia</p>
                              </TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Revertir asistencia?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción marcará al paciente como no asistido y agregará una nota de reversión en la historia clínica. ¿Estás seguro?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRevertAttendance(appointment.id)}>
                                  Sí, revertir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        
                        {/* Botón editar - para admin/doctor y estados específicos */}
                        {(profile?.role === 'doctor' || profile?.role === 'admin') && 
                         (appointment.status === 'scheduled' || appointment.status === 'confirmed') && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                onClick={() => handleEdit(appointment)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Editar cita</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        
                        {/* Botón reprogramar - para admin/doctor y estados específicos */}
                        {(profile?.role === 'doctor' || profile?.role === 'admin') && 
                         (appointment.status === 'scheduled' || appointment.status === 'confirmed' || 
                          appointment.status === 'no_show' || appointment.status === 'no_show_rescheduled') && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700"
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
                        
                        {/* Botón Alta Temprana - solo para admin/doctor */}
                        {(profile?.role === 'doctor' || profile?.role === 'admin') && 
                         appointment.status !== 'cancelled' && appointment.status !== 'completed' && appointment.status !== 'discharged' && (
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                                 onClick={() => handleDischarge(appointment.patient_id)}
                               >
                                 <LogOut className="h-4 w-4" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent>
                               <p>Alta temprana</p>
                             </TooltipContent>
                           </Tooltip>
                         )}
                        
                        {/* Botón cancelar */}
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

      {/* Edit Appointment Dialog */}
      {selectedAppointment && (
        <EditAppointmentDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onSuccess={() => {
            fetchAppointments();
            setEditDialogOpen(false);
            setSelectedAppointment(null);
          }}
        />
      )}

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

      {/* Discharge Patient Dialog */}
      <DischargePatientDialog
        open={dischargeDialogOpen}
        onOpenChange={setDischargeDialogOpen}
        patientInfo={patientToDischarge}
        onSuccess={() => {
          fetchAppointments();
          setDischargeDialogOpen(false);
          setPatientToDischarge(null);
        }}
      />
      </div>
    </TooltipProvider>
  );
}