import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Clock, 
  Plus, 
  User, 
  Search, 
  Calendar as CalendarIcon,
  Stethoscope,
  Users,
  CheckCircle,
  AlertCircle,
  XCircle,
  PlayCircle,
  RotateCcw
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDateToISO } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useHolidays } from '@/hooks/useHolidays';
import AppointmentForm from './AppointmentForm';

interface Doctor {
  id: string;
  profile?: {
    first_name: string;
    last_name: string;
  } | null;
  specialty?: {
    name: string;
    color: string;
  } | null;
  work_start_time: string;
  work_end_time: string;
  appointment_duration: number;
  work_days: string[];
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string;
  patient: {
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

const statusLabels = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'Asistido', 
  completed: 'Completado',
  cancelled: 'Cancelado',
  discharged: 'Dado de Alta',
  rescheduled: 'Reprogramado',
  no_show: 'Ausente',
  no_show_rescheduled: 'Ausente - Reprogramado',
  no_show_session_lost: 'Ausente - Sesión Descontada',
};

const statusColors = {
  scheduled: 'bg-gradient-to-r from-primary/5 to-primary/10 text-primary border-primary/20 dark:from-primary/10 dark:to-primary/20 dark:text-primary-light dark:border-primary/30',
  confirmed: 'bg-gradient-to-r from-success/5 to-success/10 text-success border-success/20 dark:from-success/10 dark:to-success/20 dark:text-success-light dark:border-success/30',
  in_progress: 'bg-gradient-to-r from-warning/5 to-warning/10 text-warning border-warning/20 dark:from-warning/10 dark:to-warning/20 dark:text-warning-light dark:border-warning/30',
  completed: 'bg-gradient-to-r from-primary/10 to-primary/15 text-primary-dark border-primary/25 dark:from-primary/20 dark:to-primary/30 dark:text-primary-light dark:border-primary/40',
  cancelled: 'bg-gradient-to-r from-destructive/5 to-destructive/10 text-destructive border-destructive/20 dark:from-destructive/10 dark:to-destructive/20 dark:text-destructive-foreground dark:border-destructive/30',
  discharged: 'bg-gradient-to-r from-accent/10 to-accent/20 text-accent-foreground border-accent/30 dark:from-accent/15 dark:to-accent/25 dark:text-accent-foreground dark:border-accent/40',
  no_show: 'bg-gradient-to-r from-muted/50 to-muted text-muted-foreground border-border dark:from-muted dark:to-muted/80 dark:text-muted-foreground dark:border-border',
};

const statusIcons = {
  scheduled: CalendarIcon,
  confirmed: CheckCircle,
  in_progress: PlayCircle,
  completed: CheckCircle,
  cancelled: XCircle,
  discharged: CheckCircle,
  rescheduled: CalendarIcon,
  no_show: AlertCircle,
  no_show_rescheduled: AlertCircle,
  no_show_session_lost: AlertCircle,
};

export default function AppointmentCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: holidays = [] } = useHolidays();

  useEffect(() => {
    fetchDoctors();
    fetchAppointments();
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate, selectedDoctor]);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id,
          work_start_time,
          work_end_time,
          appointment_duration,
          work_days,
          profile_id,
          specialty_id
        `)
        .eq('is_active', true);

      if (error) throw error;
      
      // Fetch profiles and specialties separately
      const profileIds = data?.map(d => d.profile_id).filter(Boolean) || [];
      const specialtyIds = data?.map(d => d.specialty_id).filter(Boolean) || [];
      
      const [profilesData, specialtiesData] = await Promise.all([
        profileIds.length > 0 ? supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', profileIds) : { data: [] },
        specialtyIds.length > 0 ? supabase
          .from('specialties')
          .select('id, name, color')
          .in('id', specialtyIds) : { data: [] }
      ]);
      
      // Transform the data to match the expected interface
      const transformedData = data?.map(doctor => {
        const profile = profilesData.data?.find(p => p.id === doctor.profile_id);
        const specialty = specialtiesData.data?.find(s => s.id === doctor.specialty_id);
        
        return {
          ...doctor,
          profile: profile ? {
            first_name: profile.first_name,
            last_name: profile.last_name
          } : null,
          specialty: specialty ? {
            name: specialty.name,
            color: specialty.color
          } : null
        };
      }) || [];
      
      setDoctors(transformedData);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los doctores",
        variant: "destructive",
      });
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('appointments')
        .select(`
          *
        `)
        .eq('appointment_date', formatDateToISO(selectedDate))
        .order('appointment_time', { ascending: true });

      if (selectedDoctor !== 'all') {
        query = query.eq('doctor_id', selectedDoctor);
      }

      const { data: appointmentsData, error } = await query;

      if (error) throw error;
      
      // Get unique patient and doctor IDs
      const patientIds = [...new Set(appointmentsData?.map(a => a.patient_id).filter(Boolean))];
      const doctorIds = [...new Set(appointmentsData?.map(a => a.doctor_id).filter(Boolean))];
      
      // PASO 1: Fetch patients y doctors primero
      const [patientsData, doctorsData] = await Promise.all([
        patientIds.length > 0 ? supabase.from('patients').select('id, profile_id').in('id', patientIds) : { data: [] },
        doctorIds.length > 0 ? supabase.from('doctors').select('id, profile_id, specialty_id').in('id', doctorIds) : { data: [] },
      ]);

      // PASO 2: Recopilar profile_ids necesarios
      const allProfileIds = [
        ...new Set([
          ...(patientsData.data?.map(p => p.profile_id).filter(Boolean) || []),
          ...(doctorsData.data?.map(d => d.profile_id).filter(Boolean) || [])
        ])
      ];

      // PASO 3: Fetch profiles y specialties con IDs específicos
      const [profilesData, specialtiesData] = await Promise.all([
        allProfileIds.length > 0 
          ? supabase.from('profiles').select('id, first_name, last_name').in('id', allProfileIds)
          : { data: [] },
        supabase.from('specialties').select('id, name, color')
      ]);
      
      // Transform appointments with proper relations
      const transformedAppointments = appointmentsData?.map(appointment => {
        const patient = patientsData.data?.find(p => p.id === appointment.patient_id);
        const patientProfile = patient ? profilesData.data?.find(pr => pr.id === patient.profile_id) : null;
        
        const doctor = doctorsData.data?.find(d => d.id === appointment.doctor_id);
        const doctorProfile = doctor ? profilesData.data?.find(pr => pr.id === doctor.profile_id) : null;
        const specialty = doctor ? specialtiesData.data?.find(s => s.id === doctor.specialty_id) : null;
        
        return {
          ...appointment,
          patient: patient ? {
            profile: patientProfile ? {
              first_name: patientProfile.first_name,
              last_name: patientProfile.last_name
            } : null
          } : null,
          doctor: doctor ? {
            id: doctor.id,
            profile: doctorProfile ? {
              first_name: doctorProfile.first_name,
              last_name: doctorProfile.last_name
            } : null,
            specialty: specialty ? {
              name: specialty.name,
              color: specialty.color
            } : null
          } : null
        };
      }) || [];
      
      setAppointments(transformedAppointments);
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

  const generateTimeSlots = () => {
    const slots = [];
    
    // Verificar si la fecha seleccionada es feriado
    const selectedDateStr = formatDateToISO(selectedDate);
    const holidayOnDate = holidays.find(h => h.date === selectedDateStr);
    
    // If "all doctors" is selected, generate slots based on the union of all doctor schedules
    if (selectedDoctor === 'all') {
      if (doctors.length === 0) return [];
      
      // Get the day name for filtering
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const selectedDayName = dayNames[selectedDate.getDay()];
      
      // Find doctors that work on this day
      const workingDoctors = doctors.filter(doctor => 
        doctor.work_days && doctor.work_days.includes(selectedDayName)
      );
      
      if (workingDoctors.length === 0) return [];
      
      // Find the earliest start time and latest end time
      const startTimes = workingDoctors.map(d => d.work_start_time || '08:00:00');
      const endTimes = workingDoctors.map(d => d.work_end_time || '17:00:00');
      const durations = workingDoctors.map(d => d.appointment_duration || 30);
      
      const earliestStart = startTimes.sort()[0];
      const latestEnd = endTimes.sort().reverse()[0];
      const commonDuration = Math.min(...durations); // Use the smallest duration
      
      const [startHour, startMinute] = earliestStart.split(':').map(Number);
      const [endHour, endMinute] = latestEnd.split(':').map(Number);
      
      let currentHour = startHour;
      let currentMinute = startMinute;
      
      while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
        const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`;
        
        // Count how many doctors are available at this time
        const availableDoctorsAtTime = workingDoctors.filter(doctor => {
          const doctorStart = doctor.work_start_time || '08:00:00';
          const doctorEnd = doctor.work_end_time || '17:00:00';
          return timeString >= doctorStart && timeString < doctorEnd;
        }).length;
        
        // Get appointments for this time slot
        const allTimeAppointments = appointments.filter(apt => 
          apt.appointment_time === timeString
        );
        
        const activeTimeAppointments = appointments.filter(apt => 
          apt.appointment_time === timeString && !['cancelled', 'discharged', 'completed', 'no_show'].includes(apt.status)
        );
        
        // Maximum slots = number of available doctors * 3 (assuming 3 slots per doctor)
        const maxSlots = availableDoctorsAtTime * 3;
        const availableSlots = maxSlots - activeTimeAppointments.length;
        
        slots.push({
          time: timeString,
          display: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
          appointments: allTimeAppointments,
          availableSlots,
          isFull: activeTimeAppointments.length >= maxSlots,
          maxSlots,
          isHoliday: !!holidayOnDate,
          holidayName: holidayOnDate?.name
        });
        
        currentMinute += commonDuration;
        if (currentMinute >= 60) {
          currentHour += Math.floor(currentMinute / 60);
          currentMinute = currentMinute % 60;
        }
      }
      
      return slots;
    }
    
    // Handle specific doctor selection
    const doctor = doctors.find(d => d.id === selectedDoctor);
    
    if (!doctor) return [];

    // Check if the selected date is a working day for this doctor
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const selectedDayName = dayNames[selectedDate.getDay()];
    
    // If the doctor doesn't work on this day, return empty slots
    if (!doctor.work_days || !doctor.work_days.includes(selectedDayName)) {
      return [];
    }

    const startTime = doctor.work_start_time || '08:00:00';
    const endTime = doctor.work_end_time || '17:00:00';
    const duration = doctor.appointment_duration || 30;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    let currentHour = startHour;
    let currentMinute = startMinute;

    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`;
      
      // Todas las citas para este horario (incluyendo canceladas para mostrar en UI)
      const allTimeAppointments = appointments.filter(apt => 
        apt.appointment_time === timeString
      );
      
      // Solo citas activas para calcular disponibilidad (excluyendo estados finalizados)
      const activeTimeAppointments = appointments.filter(apt => 
        apt.appointment_time === timeString && !['cancelled', 'discharged', 'completed', 'no_show'].includes(apt.status)
      );
      
      const maxSlots = 3; // Máximo 3 citas simultáneas
      const availableSlots = maxSlots - activeTimeAppointments.length;
      
      slots.push({
        time: timeString,
        display: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
        appointments: allTimeAppointments, // Mostrar todas las citas incluyendo canceladas
        availableSlots,
        isFull: activeTimeAppointments.length >= maxSlots, // Disponibilidad basada solo en citas activas
        maxSlots,
        isHoliday: !!holidayOnDate,
        holidayName: holidayOnDate?.name
      });

      currentMinute += duration;
      if (currentMinute >= 60) {
        currentHour += Math.floor(currentMinute / 60);
        currentMinute = currentMinute % 60;
      }
    }

    return slots;
  };

  const handleAppointmentCreated = () => {
    fetchAppointments();
    setIsNewAppointmentOpen(false);
    setSelectedTimeSlot('');
  };

  const handleTimeSlotClick = (time: string, isFull: boolean) => {
    if ((profile?.role === 'admin' || profile?.role === 'reception' || profile?.role === 'secretaria' || profile?.role === 'super_admin') && !isFull) {
      setSelectedTimeSlot(time);
      setIsNewAppointmentOpen(true);
    }
  };

  const handleStatusUpdate = async (appointmentId: string, newStatus: 'completed' | 'no_show') => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      const statusMessages = {
        completed: "Paciente marcado como asistido y sesión completada",
        no_show: "Paciente marcado como ausente"
      };

      toast({
        title: "Éxito",
        description: statusMessages[newStatus],
      });

      // Cerrar el popover
      setOpenPopovers(prev => ({ ...prev, [appointmentId]: false }));
      
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

      // Cerrar el popover
      setOpenPopovers(prev => ({ ...prev, [appointmentId]: false }));

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

  const timeSlots = generateTimeSlots();

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Calendario de Citas
            </h1>
            <p className="text-muted-foreground mt-1">Gestiona tus citas médicas de forma eficiente</p>
          </div>
          {/* Nueva Cita button hidden per user request */}
        </div>

        {/* Main Layout - Fixed Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Sidebar - Fixed Width */}
          <div className="xl:col-span-3">
            <div className="space-y-4 sticky top-4">
              {/* Doctor Filter */}
              <Card className="border border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    Profesional
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between text-left font-normal"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Users className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            {selectedDoctor === 'all' 
                              ? 'Todos los doctores'
                              : doctors.find(d => d.id === selectedDoctor)
                                ? `Dr. ${doctors.find(d => d.id === selectedDoctor)?.profile?.first_name} ${doctors.find(d => d.id === selectedDoctor)?.profile?.last_name}`
                                : 'Seleccionar doctor'
                            }
                          </span>
                        </div>
                        <Search className="ml-2 h-4 w-4 flex-shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Buscar doctor..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron doctores.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              key="all"
                              value="all"
                              onSelect={() => setSelectedDoctor('all')}
                            >
                              <Users className="h-4 w-4 mr-2" />
                              Todos los doctores
                            </CommandItem>
                            {doctors.map((doctor) => (
                              <CommandItem
                                key={doctor.id}
                                value={`${doctor.profile?.first_name} ${doctor.profile?.last_name} ${doctor.specialty?.name}`}
                                onSelect={() => setSelectedDoctor(doctor.id)}
                              >
                                <Stethoscope className="h-4 w-4 mr-2" />
                                <div className="flex flex-col">
                                  <span>Dr. {doctor.profile?.first_name} {doctor.profile?.last_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {doctor.specialty?.name}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </CardContent>
              </Card>

              {/* Calendar */}
              <Card className="border border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    Seleccionar Fecha
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    locale={es}
                    disabled={(date) => {
                      const dateStr = formatDateToISO(date);
                      return holidays.some(h => h.date === dateStr);
                    }}
                    className="w-full p-3 pointer-events-auto"
                    classNames={{
                      months: "flex w-full flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                      row: "flex w-full mt-2",
                      cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
                      day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                      day_range_end: "day-range-end",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_hidden: "invisible",
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content - Time Slots */}
          <div className="xl:col-span-9">
            <Card className="border border-border">
              <CardHeader className="bg-muted/50 border-b border-border">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Horarios - {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: es })}
                  </CardTitle>
                  {selectedDoctor !== 'all' && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                        <Stethoscope className="h-3 w-3 mr-1" />
                        Dr. {doctors.find(d => d.id === selectedDoctor)?.profile?.first_name} {doctors.find(d => d.id === selectedDoctor)?.profile?.last_name}
                      </Badge>
                      <Badge variant="outline">
                        {doctors.find(d => d.id === selectedDoctor)?.specialty?.name}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary/20 border-t-primary"></div>
                    <p className="text-muted-foreground mt-4">Cargando horarios...</p>
                  </div>
                ) : selectedDoctor === 'all' ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">Selecciona un profesional</h3>
                    <p className="text-muted-foreground">Elige un doctor para ver los horarios disponibles</p>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">Sin horarios disponibles</h3>
                    <p className="text-muted-foreground">
                      {(() => {
                        const doctor = doctors.find(d => d.id === selectedDoctor);
                        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                        const selectedDayName = dayNames[selectedDate.getDay()];
                        
                        if (doctor && doctor.work_days && !doctor.work_days.includes(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()])) {
                          return `El Dr. ${doctor.profile?.first_name} ${doctor.profile?.last_name} no trabaja los ${selectedDayName}s`;
                        }
                        return 'No hay turnos programados para este doctor en esta fecha';
                      })()}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {timeSlots.map((slot) => {
                      // Si es feriado, mostrar tarjeta especial
                      if (slot.isHoliday) {
                        return (
                          <Card
                            key={slot.time}
                            className="transition-all duration-200 border-2 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 cursor-not-allowed opacity-60"
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-2xl">🎊</span>
                                <span className="font-semibold text-red-600 dark:text-red-400">
                                  {slot.holidayName || 'Feriado'}
                                </span>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0 text-center">
                              <p className="text-xs text-red-600 dark:text-red-400">
                                No se pueden agendar turnos
                              </p>
                            </CardContent>
                          </Card>
                        );
                      }
                      
                       return (
                         <Card
                           key={slot.time}
                           className={`transition-all duration-200 hover:shadow-md border-2 ${
                             slot.isFull
                               ? 'bg-destructive/10 border-destructive/20 hover:bg-destructive/15 dark:bg-destructive/20 dark:border-destructive/30 dark:hover:bg-destructive/25'
                               : 'bg-success/10 border-success/20 hover:bg-success/15 dark:bg-success/20 dark:border-success/30 dark:hover:bg-success/25'
                           }`}
                         >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-full ${
                                  slot.isFull ? 'bg-destructive/20 dark:bg-destructive/30' : 'bg-success/20 dark:bg-success/30'
                                }`}>
                                  <Clock className={`h-4 w-4 ${
                                    slot.isFull ? 'text-destructive dark:text-destructive-foreground' : 'text-success dark:text-success-light'
                                  }`} />
                                </div>
                                <span className="font-semibold">{slot.display}</span>
                              </div>
                              <Badge 
                                variant={slot.isFull ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {slot.availableSlots}/{slot.maxSlots}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {slot.appointments.length > 0 ? (
                              <div className="space-y-2">
                                {slot.appointments.map((appointment) => {
                                  const AppointmentStatusIcon = statusIcons[appointment.status as keyof typeof statusIcons] || User;
                                  return (
                                    <div 
                                      key={appointment.id}
                                      className="p-3 bg-card rounded-lg border border-border"
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className="p-1 rounded-full bg-primary/10 dark:bg-primary/20">
                                          <User className="h-3 w-3 text-primary dark:text-primary-light" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm text-foreground mb-1">
                                            {appointment.patient?.profile?.first_name || 'N/A'} {appointment.patient?.profile?.last_name || ''}
                                          </div>
                                             {(appointment.status !== 'completed' && appointment.status !== 'no_show' && appointment.status !== 'cancelled' && appointment.status !== 'discharged') && (profile?.role === 'admin' || profile?.role === 'doctor' || profile?.role === 'reception') ? (
                                              <Popover 
                                                open={openPopovers[appointment.id] || false}
                                                onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, [appointment.id]: open }))}
                                              >
                                                 <PopoverTrigger asChild>
                                                    <div className={`inline-flex items-center text-xs cursor-pointer rounded-md px-2 py-1 ${
                                                      appointment.status === 'cancelled' 
                                                        ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground border border-destructive/50'
                                                        : appointment.status === 'completed' || appointment.status === 'in_progress'
                                                        ? 'bg-success hover:bg-success/90 text-success-foreground border border-success/50'
                                                        : 'bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/50'
                                                    }`}>
                                                     <CalendarIcon className="h-3 w-3 mr-1" />
                                                     {statusLabels[appointment.status] || appointment.status}
                                                   </div>
                                                 </PopoverTrigger>
                                                 <PopoverContent className="w-48 p-2 bg-popover shadow-lg border rounded-md z-50">
                                                   <div className="space-y-1">
                                                     {appointment.status !== 'in_progress' ? (
                                                       <>
                                                         <Tooltip>
                                                           <TooltipTrigger asChild>
                                                             <Button
                                                               variant="ghost"
                                                               size="sm"
                                                               className="w-8 h-8 p-0 text-success hover:text-success hover:bg-success/10 dark:hover:bg-success/20"
                                                               onClick={(e) => {
                                                                 e.stopPropagation();
                                                                 handleStatusUpdate(appointment.id, 'completed');
                                                               }}
                                                             >
                                                               <CheckCircle className="h-4 w-4" />
                                                             </Button>
                                                           </TooltipTrigger>
                                                           <TooltipContent>
                                                             <p>Marcar como asistido</p>
                                                           </TooltipContent>
                                                         </Tooltip>
                                                       </>
                                                     ) : (
                                                       <Tooltip>
                                                         <TooltipTrigger asChild>
                                                           <Button
                                                             variant="ghost"
                                                             size="sm"
                                                             className="w-8 h-8 p-0 text-warning hover:text-warning hover:bg-warning/10 dark:hover:bg-warning/20"
                                                             onClick={(e) => {
                                                               e.stopPropagation();
                                                               handleRevertAttendance(appointment.id);
                                                             }}
                                                           >
                                                             <RotateCcw className="h-4 w-4" />
                                                           </Button>
                                                         </TooltipTrigger>
                                                         <TooltipContent>
                                                           <p>Revertir asistencia</p>
                                                         </TooltipContent>
                                                       </Tooltip>
                                                     )}
                                                   </div>
                                                 </PopoverContent>
                                              </Popover>
                                            ) : (
                                              <Badge 
                                                className={`text-xs ${statusColors[appointment.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}
                                              >
                                                {(() => {
                                                  const StatusIcon = statusIcons[appointment.status as keyof typeof statusIcons] || CalendarIcon;
                                                  return <StatusIcon className="h-3 w-3 mr-1" />;
                                                })()}
                                                 {statusLabels[appointment.status] || appointment.status}
                                              </Badge>
                                            )}
                                         </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                 {!slot.isFull && (
                                   <div 
                                     className="text-center pt-2 border-t border-dashed border-success/30 cursor-pointer hover:bg-success/10 transition-colors rounded-md p-2 dark:border-success/40 dark:hover:bg-success/20"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       handleTimeSlotClick(slot.time, slot.isFull);
                                     }}
                                   >
                                     <div className="text-xs text-success font-medium dark:text-success-light">
                                       <Plus className="h-3 w-3 inline mr-1" />
                                       {slot.availableSlots} disponible{slot.availableSlots !== 1 ? 's' : ''}
                                     </div>
                                   </div>
                                 )}
                              </div>
                            ) : (
                               <div 
                                 className="text-center py-6 cursor-pointer hover:bg-green-200 transition-colors rounded-md"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleTimeSlotClick(slot.time, slot.isFull);
                                 }}
                               >
                                 <div className="p-3 rounded-full bg-green-200 mx-auto w-fit mb-2">
                                   <Plus className="h-6 w-6 text-green-600" />
                                 </div>
                                 <p className="text-sm font-medium text-green-700">Disponible</p>
                                 <p className="text-xs text-green-600">Click para agendar</p>
                               </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>

    {/* New Appointment Dialog */}
    <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Cita</DialogTitle>
          <DialogDescription>
            Crear una nueva cita para {selectedTimeSlot && format(selectedDate, 'PPP', { locale: es })} a las {selectedTimeSlot}
          </DialogDescription>
        </DialogHeader>
        <AppointmentForm
          onSuccess={handleAppointmentCreated}
          selectedDate={selectedDate}
          selectedTime={selectedTimeSlot}
          selectedDoctor={selectedDoctor !== 'all' ? selectedDoctor : undefined}
        />
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}
