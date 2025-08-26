import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  PlayCircle
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
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
}

const statusLabels = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'Asistido', 
  completed: 'Completado',
  cancelled: 'Cancelado',
  rescheduled: 'Reprogramado',
  no_show: 'Ausente',
  no_show_rescheduled: 'Ausente - Reprogramado',
  no_show_session_lost: 'Ausente - Sesión Descontada',
};

const statusColors = {
  scheduled: 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200',
  confirmed: 'bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200',
  in_progress: 'bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-200',
  cancelled: 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-red-200',
  no_show: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border-gray-200',
};

const statusIcons = {
  scheduled: CalendarIcon,
  confirmed: CheckCircle,
  in_progress: PlayCircle,
  completed: CheckCircle,
  cancelled: XCircle,
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
          profile:profiles(first_name, last_name),
          specialty:specialties(name, color)
        `)
        .eq('is_active', true);

      if (error) throw error;
      setDoctors(data || []);
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
          *,
          patient:patients(
            profile:profiles(first_name, last_name)
          ),
          doctor:doctors(
            id,
            profile:profiles(first_name, last_name),
            specialty:specialties(name, color)
          )
        `)
        .eq('appointment_date', format(selectedDate, 'yyyy-MM-dd'))
        .order('appointment_time', { ascending: true });

      if (selectedDoctor !== 'all') {
        query = query.eq('doctor_id', selectedDoctor);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAppointments(data || []);
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
    const doctor = doctors.find(d => d.id === selectedDoctor);
    
    if (!doctor) return [];

    const startTime = doctor.work_start_time || '08:00:00';
    const endTime = doctor.work_end_time || '17:00:00';
    const duration = doctor.appointment_duration || 30;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    let currentHour = startHour;
    let currentMinute = startMinute;

    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`;
      // Excluir turnos cancelados del conteo de slots ocupados
      const timeAppointments = appointments.filter(apt => 
        apt.appointment_time === timeString && apt.status !== 'cancelled'
      );
      const maxSlots = 3; // Máximo 3 citas simultáneas
      const availableSlots = maxSlots - timeAppointments.length;
      
      slots.push({
        time: timeString,
        display: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
        appointments: timeAppointments,
        availableSlots,
        isFull: timeAppointments.length >= maxSlots,
        maxSlots
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
    if ((profile?.role === 'patient' || profile?.role === 'admin') && !isFull) {
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

  const timeSlots = generateTimeSlots();

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Calendario de Citas
            </h1>
            <p className="text-slate-600 mt-1">Gestiona tus citas médicas de forma eficiente</p>
          </div>
          {(profile?.role === 'patient' || profile?.role === 'admin') && (
            <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nueva Cita
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Agendar Nueva Cita
                  </DialogTitle>
                </DialogHeader>
                <AppointmentForm 
                  onSuccess={handleAppointmentCreated}
                  selectedDate={selectedDate}
                  selectedDoctor={selectedDoctor !== 'all' ? selectedDoctor : undefined}
                  selectedTime={selectedTimeSlot}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Main Layout - Fixed Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Sidebar - Fixed Width */}
          <div className="xl:col-span-3">
            <div className="space-y-4 sticky top-4">
              {/* Doctor Filter */}
              <Card className="border border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Stethoscope className="h-4 w-4 text-blue-600" />
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
              <Card className="border border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarIcon className="h-4 w-4 text-blue-600" />
                    Seleccionar Fecha
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    locale={es}
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
            <Card className="border border-slate-200">
              <CardHeader className="bg-slate-50 border-b">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Horarios - {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: es })}
                  </CardTitle>
                  {selectedDoctor !== 'all' && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
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
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
                    <p className="text-slate-500 mt-4">Cargando horarios...</p>
                  </div>
                ) : selectedDoctor === 'all' ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Selecciona un profesional</h3>
                    <p className="text-slate-500">Elige un doctor para ver los horarios disponibles</p>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Sin horarios disponibles</h3>
                    <p className="text-slate-500">No hay turnos programados para este doctor</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {timeSlots.map((slot) => {
                      return (
                         <Card
                           key={slot.time}
                           className={`transition-all duration-200 hover:shadow-md border-2 ${
                             slot.isFull
                               ? 'bg-red-50 border-red-200 hover:bg-red-100'
                               : 'bg-green-50 border-green-200 hover:bg-green-100'
                           }`}
                         >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-full ${
                                  slot.isFull ? 'bg-red-200' : 'bg-green-200'
                                }`}>
                                  <Clock className={`h-4 w-4 ${
                                    slot.isFull ? 'text-red-600' : 'text-green-600'
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
                                      className="p-3 bg-white rounded-lg border border-slate-200"
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className="p-1 rounded-full bg-blue-100">
                                          <User className="h-3 w-3 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm text-slate-900 mb-1">
                                            {appointment.patient.profile.first_name} {appointment.patient.profile.last_name}
                                          </div>
                                             {(appointment.status !== 'completed' && appointment.status !== 'no_show' && appointment.status !== 'cancelled') && (profile?.role === 'admin' || profile?.role === 'doctor' || profile?.role === 'reception') ? (
                                              <Popover 
                                                open={openPopovers[appointment.id] || false}
                                                onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, [appointment.id]: open }))}
                                              >
                                                <PopoverTrigger asChild>
                                                   <div className="inline-flex items-center text-xs cursor-pointer bg-blue-500 hover:bg-blue-600 text-white rounded-md px-2 py-1 border">
                                                     <CalendarIcon className="h-3 w-3 mr-1" />
                                                     {statusLabels[appointment.status] || appointment.status}
                                                   </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-48 p-2 bg-white shadow-lg border rounded-md z-50">
                                                  <div className="space-y-1">
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStatusUpdate(appointment.id, 'completed');
                                                      }}
                                                    >
                                                      <CheckCircle className="h-4 w-4 mr-2" />
                                                      Marcar Asistido
                                                    </Button>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStatusUpdate(appointment.id, 'no_show');
                                                      }}
                                                    >
                                                      <XCircle className="h-4 w-4 mr-2" />
                                                      Marcar Ausente
                                                    </Button>
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
                                     className="text-center pt-2 border-t border-dashed border-green-300 cursor-pointer hover:bg-green-200 transition-colors rounded-md p-2"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       handleTimeSlotClick(slot.time, slot.isFull);
                                     }}
                                   >
                                     <div className="text-xs text-green-600 font-medium">
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
  );
}