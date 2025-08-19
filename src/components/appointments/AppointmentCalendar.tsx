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
  no_show: AlertCircle,
};

export default function AppointmentCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
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

  const handleStatusClick = async (appointmentId: string, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (currentStatus === 'scheduled' && (profile?.role === 'admin' || profile?.role === 'doctor' || profile?.role === 'reception')) {
      try {
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'in_progress' })
          .eq('id', appointmentId);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Paciente marcado como presente",
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
    }
  };

  const timeSlots = generateTimeSlots();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-50/30 p-4 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Calendario de Citas
            </h1>
            <p className="text-muted-foreground mt-2">Gestiona tus citas médicas de forma eficiente</p>
          </div>
          {(profile?.role === 'patient' || profile?.role === 'admin') && (
            <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Doctor Filter */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Stethoscope className="h-5 w-5 text-blue-600" />
                  Profesional
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-12 bg-white/50 hover:bg-white/80 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="truncate">
                          {selectedDoctor === 'all' 
                            ? 'Todos los doctores'
                            : doctors.find(d => d.id === selectedDoctor)
                              ? `Dr. ${doctors.find(d => d.id === selectedDoctor)?.profile?.first_name} ${doctors.find(d => d.id === selectedDoctor)?.profile?.last_name}`
                              : 'Seleccionar doctor'
                          }
                        </span>
                      </div>
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-white/95 backdrop-blur-sm">
                    <Command>
                      <CommandInput placeholder="Buscar doctor..." className="border-0" />
                      <CommandList>
                        <CommandEmpty>No se encontraron doctores.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            key="all"
                            value="all"
                            onSelect={() => setSelectedDoctor('all')}
                            className="hover:bg-blue-50"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Todos los doctores
                          </CommandItem>
                          {doctors.map((doctor) => (
                            <CommandItem
                              key={doctor.id}
                              value={`${doctor.profile?.first_name} ${doctor.profile?.last_name} ${doctor.specialty?.name}`}
                              onSelect={() => setSelectedDoctor(doctor.id)}
                              className="hover:bg-blue-50"
                            >
                              <Stethoscope className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>Dr. {doctor.profile?.first_name || 'N/A'} {doctor.profile?.last_name || 'N/A'}</span>
                                <span className="text-xs text-muted-foreground">
                                  {doctor.specialty?.name || 'Sin especialidad'}
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
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarIcon className="h-5 w-5 text-blue-600" />
                  Seleccionar Fecha
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={es}
                  className="w-full mx-auto rounded-lg border-0 bg-white/50 p-3"
                />
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Time Slots */}
          <div className="lg:col-span-3">
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <Clock className="h-6 w-6 text-blue-600" />
                      Horarios - {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: es })}
                    </CardTitle>
                    {selectedDoctor !== 'all' && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          variant="secondary" 
                          className="bg-blue-100 text-blue-700 border-blue-200"
                        >
                          <Stethoscope className="h-3 w-3 mr-1" />
                          Dr. {doctors.find(d => d.id === selectedDoctor)?.profile?.first_name} {doctors.find(d => d.id === selectedDoctor)?.profile?.last_name}
                        </Badge>
                        <Badge 
                          variant="outline"
                          style={{ backgroundColor: `${doctors.find(d => d.id === selectedDoctor)?.specialty?.color}20` }}
                        >
                          {doctors.find(d => d.id === selectedDoctor)?.specialty?.name || 'Sin especialidad'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {loading ? (
                  <div className="text-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                    <p className="text-muted-foreground mt-4">Cargando horarios...</p>
                  </div>
                ) : selectedDoctor === 'all' ? (
                  <div className="text-center py-16">
                    <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground">Selecciona un profesional</h3>
                    <p className="text-sm text-muted-foreground mt-2">Elige un doctor para ver los horarios disponibles</p>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-16">
                    <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground">Sin horarios disponibles</h3>
                    <p className="text-sm text-muted-foreground mt-2">No hay turnos programados para este doctor</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {timeSlots.map((slot, index) => {
                      const StatusIcon = statusIcons.scheduled;
                      return (
                        <Card
                          key={slot.time}
                          className={`group relative overflow-hidden transition-all duration-300 hover:scale-105 cursor-pointer border-2 ${
                            slot.isFull
                              ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg'
                              : 'bg-gradient-to-br from-green-50 via-green-50 to-emerald-100 border-green-200 hover:shadow-xl hover:border-green-300'
                          }`}
                          style={{ animationDelay: `${index * 50}ms` }}
                          onClick={() => handleTimeSlotClick(slot.time, slot.isFull)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${
                                  slot.isFull ? 'bg-red-200' : 'bg-green-200'
                                }`}>
                                  <Clock className={`h-4 w-4 ${
                                    slot.isFull ? 'text-red-600' : 'text-green-600'
                                  }`} />
                                </div>
                                <span className="font-bold text-lg">{slot.display}</span>
                              </div>
                              <Badge 
                                variant={slot.isFull ? "destructive" : "secondary"}
                                className={`text-xs font-semibold ${
                                  slot.isFull 
                                    ? 'bg-red-200 text-red-800 border-red-300' 
                                    : 'bg-green-200 text-green-800 border-green-300'
                                }`}
                              >
                                {slot.availableSlots}/{slot.maxSlots}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {slot.appointments.length > 0 ? (
                              <div className="space-y-3">
                                {slot.appointments.map((appointment, appointmentIndex) => {
                                  const AppointmentStatusIcon = statusIcons[appointment.status as keyof typeof statusIcons] || User;
                                  return (
                                    <div 
                                      key={appointment.id}
                                      className="group/appointment p-3 bg-white/70 backdrop-blur-sm rounded-xl border-2 border-white/50 hover:bg-white/90 hover:border-white/80 transition-all duration-200 shadow-sm hover:shadow-md"
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className="p-1.5 rounded-full bg-blue-100">
                                          <User className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-semibold text-sm text-gray-900 mb-2">
                                            {appointment.patient.profile.first_name} {appointment.patient.profile.last_name}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge 
                                              className={`text-xs font-medium cursor-pointer hover:scale-105 transition-all duration-200 border ${
                                                appointment.status === 'scheduled' && (profile?.role === 'admin' || profile?.role === 'doctor' || profile?.role === 'reception')
                                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-blue-300'
                                                  : statusColors[appointment.status as keyof typeof statusColors]
                                              }`}
                                              onClick={(e) => handleStatusClick(appointment.id, appointment.status, e)}
                                              title={appointment.status === 'scheduled' && (profile?.role === 'admin' || profile?.role === 'doctor' || profile?.role === 'reception') ? 'Click para marcar como presente' : ''}
                                            >
                                              <AppointmentStatusIcon className="h-3 w-3 mr-1" />
                                              {appointment.status === 'scheduled' ? 'Agendado' : appointment.status}
                                            </Badge>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {!slot.isFull && (
                                  <div className="text-center pt-3 border-t-2 border-green-200/50 border-dashed">
                                    <div className="text-xs text-green-700 font-medium flex items-center justify-center gap-1">
                                      <Plus className="h-3 w-3" />
                                      {slot.availableSlots} disponible{slot.availableSlots !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <div className="p-4 rounded-full bg-green-200/50 mx-auto w-fit mb-3">
                                  <Plus className="h-8 w-8 text-green-600" />
                                </div>
                                <p className="text-sm font-medium text-green-700">Disponible</p>
                                <p className="text-xs text-green-600 mt-1">Click para agendar</p>
                              </div>
                            )}
                          </CardContent>
                          {!slot.isFull && (
                            <div className="absolute inset-0 bg-gradient-to-r from-green-400/0 to-emerald-400/0 group-hover:from-green-400/5 group-hover:to-emerald-400/5 transition-all duration-300 pointer-events-none" />
                          )}
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