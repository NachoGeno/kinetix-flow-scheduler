import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, X, Check, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  patient_id: z.string().min(1, 'Selecciona un paciente'),
  medical_order_id: z.string().optional(),
  doctor_id: z.string().min(1, 'Selecciona un doctor'),
  reason: z.string().min(1, 'Describe el motivo de la consulta'),
  sessions_count: z.number().min(1, 'Debe tener al menos 1 sesión'),
});

interface Doctor {
  id: string;
  profile: {
    first_name: string;
    last_name: string;
  };
  specialty: {
    name: string;
    color: string;
  };
  work_start_time: string;
  work_end_time: string;
  appointment_duration: number;
  work_days: string[];
}

interface Patient {
  id: string;
  profile: {
    first_name: string;
    last_name: string;
    dni: string | null;
    email: string;
  };
}

interface MedicalOrder {
  id: string;
  description: string;
  instructions: string | null;
  sessions_count?: number;
  doctor: {
    profile: {
      first_name: string;
      last_name: string;
    };
  };
}

interface ScheduledSession {
  date: Date;
  time: string;
  sessionNumber: number;
}

interface MultiSessionAppointmentFormProps {
  onSuccess?: () => void;
  selectedOrder?: MedicalOrder;
}

export default function MultiSessionAppointmentForm({ onSuccess, selectedOrder }: MultiSessionAppointmentFormProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicalOrders, setMedicalOrders] = useState<MedicalOrder[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_id: '',
      medical_order_id: selectedOrder?.id || 'none',
      doctor_id: '',
      reason: selectedOrder?.description || '',
      sessions_count: selectedOrder?.sessions_count || 1,
    },
  });

  useEffect(() => {
    fetchDoctors();
    fetchPatients();
    fetchMedicalOrders();
  }, []);

  useEffect(() => {
    if (form.watch('doctor_id') && selectedDate) {
      fetchAvailableSlots();
    }
  }, [form.watch('doctor_id'), selectedDate]);

  useEffect(() => {
    if (form.watch('patient_id')) {
      fetchMedicalOrders();
    }
  }, [form.watch('patient_id')]);

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

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          profile:profiles(first_name, last_name, dni, email)
        `)
        .order('profile(first_name)', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive",
      });
    }
  };

  const fetchMedicalOrders = async () => {
    const patientId = form.watch('patient_id');
    if (!patientId) {
      setMedicalOrders([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('medical_orders')
        .select(`
          id,
          description,
          instructions,
          doctor:doctors(
            profile:profiles(first_name, last_name)
          )
        `)
        .eq('patient_id', patientId)
        .eq('completed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedicalOrders(data || []);
    } catch (error) {
      console.error('Error fetching medical orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes médicas",
        variant: "destructive",
      });
    }
  };

  const fetchAvailableSlots = async () => {
    const doctorId = form.watch('doctor_id');

    if (!doctorId || !selectedDate) return;

    try {
      const doctor = doctors.find(d => d.id === doctorId);
      if (!doctor) return;

      // Get existing appointments for this doctor and date
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', format(selectedDate, 'yyyy-MM-dd'))
        .neq('status', 'cancelled');

      if (error) throw error;

      // Generate all possible time slots
      const slots = [];
      const startTime = doctor.work_start_time || '08:00:00';
      const endTime = doctor.work_end_time || '17:00:00';
      const duration = doctor.appointment_duration || 30;

      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      let currentHour = startHour;
      let currentMinute = startMinute;

      while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
        const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`;
        slots.push(timeString);

        currentMinute += duration;
        if (currentMinute >= 60) {
          currentHour += Math.floor(currentMinute / 60);
          currentMinute = currentMinute % 60;
        }
      }

      // Filter out occupied slots and already scheduled sessions
      const occupiedTimes = (appointments || []).map(apt => apt.appointment_time);
      const scheduledTimes = scheduledSessions
        .filter(session => format(session.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))
        .map(session => session.time);
      
      const availableSlots = slots.filter(slot => 
        !occupiedTimes.includes(slot) && !scheduledTimes.includes(slot)
      );

      setAvailableSlots(availableSlots);
    } catch (error) {
      console.error('Error fetching available slots:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los horarios disponibles",
        variant: "destructive",
      });
    }
  };

  const addSession = () => {
    if (!selectedDate || !selectedTime) {
      toast({
        title: "Error",
        description: "Selecciona fecha y hora para la sesión",
        variant: "destructive",
      });
      return;
    }

    const newSession: ScheduledSession = {
      date: selectedDate,
      time: selectedTime,
      sessionNumber: scheduledSessions.length + 1,
    };

    setScheduledSessions([...scheduledSessions, newSession]);
    setSelectedDate(undefined);
    setSelectedTime('');
    setAvailableSlots([]);

    toast({
      title: "Sesión agregada",
      description: `Sesión ${newSession.sessionNumber} programada para ${format(selectedDate, 'dd/MM/yyyy')} a las ${selectedTime.substring(0, 5)}`,
    });
  };

  const removeSession = (index: number) => {
    const newSessions = scheduledSessions.filter((_, i) => i !== index);
    // Renumerar las sesiones
    const renumberedSessions = newSessions.map((session, i) => ({
      ...session,
      sessionNumber: i + 1,
    }));
    setScheduledSessions(renumberedSessions);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (scheduledSessions.length === 0) {
      toast({
        title: "Error",
        description: "Debes programar al menos una sesión",
        variant: "destructive",
      });
      return;
    }

    if (scheduledSessions.length !== values.sessions_count) {
      toast({
        title: "Error",
        description: `Debes programar exactamente ${values.sessions_count} sesiones. Actualmente tienes ${scheduledSessions.length}`,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Crear todas las citas
      const appointments = scheduledSessions.map((session) => ({
        patient_id: values.patient_id,
        doctor_id: values.doctor_id,
        appointment_date: format(session.date, 'yyyy-MM-dd'),
        appointment_time: session.time,
        reason: values.reason,
        status: 'scheduled' as const,
        notes: `Sesión ${session.sessionNumber} de ${values.sessions_count}`,
      }));

      const { error } = await supabase
        .from('appointments')
        .insert(appointments);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Se crearon ${scheduledSessions.length} citas correctamente`,
      });

      form.reset();
      setScheduledSessions([]);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron crear las citas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sessionsRemaining = form.watch('sessions_count') - scheduledSessions.length;

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="patient_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paciente</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar paciente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.profile.first_name} {patient.profile.last_name}
                        {patient.profile.dni && (
                          <span className="text-sm text-muted-foreground ml-2">
                            (DNI: {patient.profile.dni})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="medical_order_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Orden Médica</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar orden médica" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin orden médica</SelectItem>
                    {medicalOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.description.substring(0, 50)}...
                        <span className="text-sm text-muted-foreground ml-2">
                          (Dr. {order.doctor.profile.first_name} {order.doctor.profile.last_name})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sessions_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cantidad de Sesiones Total</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="doctor_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Doctor</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar doctor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        Dr. {doctor.profile.first_name} {doctor.profile.last_name}
                        <span className="text-sm text-muted-foreground ml-2">
                          ({doctor.specialty.name})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Motivo de la consulta</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe el motivo de la consulta..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Session Scheduling Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Programar Sesiones
                <Badge variant={sessionsRemaining === 0 ? "default" : "secondary"}>
                  {scheduledSessions.length} / {form.watch('sessions_count')} sesiones
                </Badge>
              </CardTitle>
              <CardDescription>
                Selecciona las fechas y horarios específicos para cada sesión
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessionsRemaining > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div>
                    <label className="text-sm font-medium">Fecha</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          {selectedDate ? (
                            format(selectedDate, "PPP", { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                          initialFocus
                          locale={es}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Hora</label>
                    <Select value={selectedTime} onValueChange={setSelectedTime}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar hora" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSlots.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot.substring(0, 5)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={addSession}
                      disabled={!selectedDate || !selectedTime}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Sesión
                    </Button>
                  </div>
                </div>
              )}

              {/* Scheduled Sessions List */}
              {scheduledSessions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Sesiones Programadas:</h4>
                  <div className="space-y-2">
                    {scheduledSessions.map((session, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <span className="font-medium">Sesión {session.sessionNumber}</span>
                          <span className="text-muted-foreground ml-2">
                            {format(session.date, 'EEEE, dd/MM/yyyy', { locale: es })} a las {session.time.substring(0, 5)}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeSession(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || scheduledSessions.length !== form.watch('sessions_count')}
          >
            {loading ? 'Creando citas...' : `Crear ${scheduledSessions.length} Citas`}
          </Button>
        </form>
      </Form>
    </div>
  );
}