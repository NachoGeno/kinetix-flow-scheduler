import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Clock, Plus, User, Search } from 'lucide-react';
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
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Calendario de Citas</h1>
        {(profile?.role === 'patient' || profile?.role === 'admin') && (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Fecha</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={es}
                className="rounded-md border pointer-events-auto"
              />
            </CardContent>
          </Card>

          {/* Doctor Filter */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Filtrar por Profesional</CardTitle>
            </CardHeader>
            <CardContent>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedDoctor === 'all' 
                      ? 'Todos los doctores'
                      : doctors.find(d => d.id === selectedDoctor)
                        ? `Dr. ${doctors.find(d => d.id === selectedDoctor)?.profile?.first_name} ${doctors.find(d => d.id === selectedDoctor)?.profile?.last_name}`
                        : 'Seleccionar doctor'
                    }
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                          Todos los doctores
                        </CommandItem>
                        {doctors.map((doctor) => (
                          <CommandItem
                            key={doctor.id}
                            value={`${doctor.profile?.first_name} ${doctor.profile?.last_name} ${doctor.specialty?.name}`}
                            onSelect={() => setSelectedDoctor(doctor.id)}
                          >
                            Dr. {doctor.profile?.first_name || 'N/A'} {doctor.profile?.last_name || 'N/A'}
                            <span className="text-sm text-muted-foreground ml-2">
                              ({doctor.specialty?.name || 'Sin especialidad'})
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
        </div>

        {/* Time Slots */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Horarios - {format(selectedDate, 'PPP', { locale: es })}
              </CardTitle>
              {selectedDoctor !== 'all' && (
                <div className="text-sm text-muted-foreground">
                  {doctors.find(d => d.id === selectedDoctor)?.profile?.first_name || 'N/A'} {doctors.find(d => d.id === selectedDoctor)?.profile?.last_name || 'N/A'} - {doctors.find(d => d.id === selectedDoctor)?.specialty?.name || 'Sin especialidad'}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Cargando horarios...</div>
              ) : selectedDoctor === 'all' ? (
                <div className="text-center py-8 text-muted-foreground">
                  Selecciona un doctor para ver los horarios disponibles
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay horarios disponibles para este doctor
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {timeSlots.map((slot) => (
                    <Card
                      key={slot.time}
                      className={`transition-all duration-200 ${
                        slot.isFull
                          ? 'bg-red-50 border-red-200'
                          : 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer hover:shadow-md'
                      }`}
                      onClick={() => handleTimeSlotClick(slot.time, slot.isFull)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2" />
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
                          <div className="space-y-3">
                            {slot.appointments.map((appointment, index) => (
                              <div 
                                key={appointment.id}
                                className="p-3 bg-card rounded-lg border shadow-sm"
                              >
                                <div className="flex items-start gap-2">
                                  <User className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-900 break-words">
                                      {appointment.patient.profile.first_name} {appointment.patient.profile.last_name}
                                    </div>
                                     <div className="mt-1">
                                       <Badge 
                                         className={`text-xs cursor-pointer hover:opacity-80 transition-opacity ${
                                           appointment.status === 'scheduled' && (profile?.role === 'admin' || profile?.role === 'doctor' || profile?.role === 'reception')
                                             ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                             : statusColors[appointment.status as keyof typeof statusColors]
                                         }`}
                                         onClick={(e) => handleStatusClick(appointment.id, appointment.status, e)}
                                         title={appointment.status === 'scheduled' && (profile?.role === 'admin' || profile?.role === 'doctor' || profile?.role === 'reception') ? 'Click para marcar como presente' : ''}
                                       >
                                         {appointment.status === 'scheduled' ? 'Agendado' : appointment.status}
                                       </Badge>
                                     </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {!slot.isFull && (
                              <div className="text-center pt-2 border-t border-green-200">
                                <div className="text-xs text-green-600 font-medium">
                                  + {slot.availableSlots} slot{slot.availableSlots !== 1 ? 's' : ''} disponible{slot.availableSlots !== 1 ? 's' : ''}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <div className="text-sm text-green-600 font-medium mb-1">
                              {slot.maxSlots} slots disponibles
                            </div>
                            <div className="text-xs text-green-500">
                              Clic para agendar
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}