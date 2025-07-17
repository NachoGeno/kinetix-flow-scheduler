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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import PatientForm from '@/components/patients/PatientForm';
import MedicalOrderForm from './MedicalOrderForm';

const formSchema = z.object({
  patient_id: z.string().min(1, 'Selecciona un paciente'),
  medical_order_id: z.string().optional(),
  doctor_id: z.string().min(1, 'Selecciona un doctor'),
  appointment_date: z.date({
    required_error: 'Selecciona una fecha',
  }),
  appointment_time: z.string().min(1, 'Selecciona una hora'),
  reason: z.string().min(1, 'Describe el motivo de la consulta'),
  sessions_count: z.number().min(1).optional(),
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

interface AppointmentFormProps {
  onSuccess?: () => void;
  selectedDate?: Date;
  selectedDoctor?: string;
  selectedTime?: string;
}

export default function AppointmentForm({ onSuccess, selectedDate, selectedDoctor, selectedTime }: AppointmentFormProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicalOrders, setMedicalOrders] = useState<MedicalOrder[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isNewPatientDialogOpen, setIsNewPatientDialogOpen] = useState(false);
  const [isNewOrderDialogOpen, setIsNewOrderDialogOpen] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_id: '',
      medical_order_id: '',
      doctor_id: selectedDoctor || '',
      appointment_date: selectedDate || undefined,
      appointment_time: selectedTime || '',
      reason: '',
      sessions_count: 1,
    },
  });

  useEffect(() => {
    fetchDoctors();
    fetchPatients();
    fetchMedicalOrders();
  }, []);

  useEffect(() => {
    if (form.watch('doctor_id') && form.watch('appointment_date')) {
      fetchAvailableSlots();
    }
  }, [form.watch('doctor_id'), form.watch('appointment_date')]);

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
    const appointmentDate = form.watch('appointment_date');

    if (!doctorId || !appointmentDate) return;

    try {
      const doctor = doctors.find(d => d.id === doctorId);
      if (!doctor) return;

      // Get existing appointments for this doctor and date
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', format(appointmentDate, 'yyyy-MM-dd'))
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

      // Filter out occupied slots
      const occupiedTimes = (appointments || []).map(apt => apt.appointment_time);
      const availableSlots = slots.filter(slot => !occupiedTimes.includes(slot));

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

  const handleNewPatientCreated = () => {
    fetchPatients();
    setIsNewPatientDialogOpen(false);
  };

  const handleNewOrderCreated = (order: any) => {
    // Actualizar el formulario con la nueva orden
    form.setValue('medical_order_id', order.id);
    form.setValue('sessions_count', order.sessions_count || 1);
    form.setValue('reason', order.description);
    
    fetchMedicalOrders();
    setIsNewOrderDialogOpen(false);
    
    toast({
      title: "Orden creada",
      description: `Orden médica creada con ${order.sessions_count} sesiones`,
    });
  };

  const createMultipleAppointments = async (values: z.infer<typeof formSchema>, sessionsCount: number) => {
    const appointments = [];
    const startDate = new Date(values.appointment_date);
    const doctor = doctors.find(d => d.id === values.doctor_id);
    
    if (!doctor) {
      throw new Error('Doctor no encontrado');
    }

    // Generar fechas para las citas (semanalmente)
    for (let i = 0; i < sessionsCount; i++) {
      const appointmentDate = new Date(startDate);
      appointmentDate.setDate(startDate.getDate() + (i * 7)); // Cada semana

      appointments.push({
        patient_id: values.patient_id,
        doctor_id: values.doctor_id,
        appointment_date: format(appointmentDate, 'yyyy-MM-dd'),
        appointment_time: values.appointment_time,
        reason: values.reason,
        status: 'scheduled',
        notes: i === 0 ? 'Primera sesión' : `Sesión ${i + 1} de ${sessionsCount}`,
      });
    }

    const { error } = await supabase
      .from('appointments')
      .insert(appointments);

    if (error) throw error;

    return appointments;
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);

      // Determinar cantidad de sesiones
      const sessionsCount = values.sessions_count || 1;

      if (sessionsCount > 1) {
        // Crear múltiples citas
        await createMultipleAppointments(values, sessionsCount);
        
        toast({
          title: "Éxito",
          description: `Se crearon ${sessionsCount} citas correctamente`,
        });
      } else {
        // Crear una sola cita
        const { error } = await supabase
          .from('appointments')
          .insert({
            patient_id: values.patient_id,
            doctor_id: values.doctor_id,
            appointment_date: format(values.appointment_date, 'yyyy-MM-dd'),
            appointment_time: values.appointment_time,
            reason: values.reason,
            status: 'scheduled'
          });

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Cita agendada correctamente",
        });
      }

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast({
        title: "Error",
        description: "No se pudo agendar la cita",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="patient_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paciente</FormLabel>
                <div className="flex gap-2">
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="flex-1">
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsNewPatientDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
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
                <div className="flex gap-2">
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar orden médica" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Sin orden médica</SelectItem>
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsNewOrderDialogOpen(true)}
                    disabled={!form.watch('patient_id')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sessions_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cantidad de Sesiones</FormLabel>
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
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
          name="appointment_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Fecha</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                    initialFocus
                    locale={es}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="appointment_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hora</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar hora" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot.substring(0, 5)}
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
                  placeholder="Describe el motivo de tu consulta..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Agendando...' : 'Agendar Cita'}
        </Button>
      </form>
    </Form>

    <Dialog open={isNewPatientDialogOpen} onOpenChange={setIsNewPatientDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Paciente</DialogTitle>
        </DialogHeader>
        <PatientForm 
          onSuccess={handleNewPatientCreated} 
          onCancel={() => setIsNewPatientDialogOpen(false)}
        />
      </DialogContent>
    </Dialog>

    <Dialog open={isNewOrderDialogOpen} onOpenChange={setIsNewOrderDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Orden Médica</DialogTitle>
        </DialogHeader>
        <MedicalOrderForm 
          onSuccess={handleNewOrderCreated} 
          onCancel={() => setIsNewOrderDialogOpen(false)}
          selectedPatient={form.watch('patient_id')}
        />
      </DialogContent>
    </Dialog>
    </>
  );
}