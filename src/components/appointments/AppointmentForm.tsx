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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  doctor_name: string | null;
  total_sessions: number;
  sessions_used: number;
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
      medical_order_id: 'none',
      doctor_id: selectedDoctor || '',
      appointment_date: selectedDate || undefined,
      appointment_time: selectedTime || '',
      reason: '',
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
        .eq('is_active', true)
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
          doctor_name,
          total_sessions,
          sessions_used
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

    console.log('fetchAvailableSlots llamado:', { doctorId, appointmentDate });

    if (!doctorId || !appointmentDate) {
      console.log('No hay doctor o fecha seleccionada');
      return;
    }

    try {
      const doctor = doctors.find(d => d.id === doctorId);
      if (!doctor) {
        console.log('Doctor no encontrado');
        return;
      }

      console.log('Doctor encontrado:', doctor);

      // Get existing appointments for this doctor and date
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', format(appointmentDate, 'yyyy-MM-dd'))
        .neq('status', 'cancelled');

      if (error) throw error;

      console.log('Citas existentes:', appointments);

      // Generate all possible time slots
      const slots = [];
      const startTime = doctor.work_start_time || '08:00:00';
      const endTime = doctor.work_end_time || '17:00:00';
      const duration = doctor.appointment_duration || 30;

      console.log('Horario del doctor:', { startTime, endTime, duration });

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

      console.log('Slots generados:', slots);

      // Contar citas por slot y filtrar los que tienen menos de 3 pacientes
      const appointmentCounts = {};
      (appointments || []).forEach(apt => {
        appointmentCounts[apt.appointment_time] = (appointmentCounts[apt.appointment_time] || 0) + 1;
      });

      console.log('Conteo de citas por slot:', appointmentCounts);

      // Mostrar solo slots con menos de 3 pacientes programados
      const availableSlots = slots.filter(slot => {
        const currentCount = appointmentCounts[slot] || 0;
        return currentCount < 3;
      });

      console.log('Slots disponibles (máximo 3 por bloque):', availableSlots);

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
    form.setValue('reason', order.description);
    
    fetchMedicalOrders();
    setIsNewOrderDialogOpen(false);
    
    toast({
      title: "Orden creada",
      description: `Orden médica creada con ${order.total_sessions} sesiones`,
    });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);

      const medicalOrderId = values.medical_order_id === 'none' ? null : values.medical_order_id;

      // Validar que el paciente tenga orden médica vigente con turnos disponibles
      if (!medicalOrderId) {
        // Verificar si el paciente tiene alguna orden médica vigente
        const { data: patientOrders, error: ordersError } = await supabase
          .from('medical_orders')
          .select('id, total_sessions, sessions_used, description')
          .eq('patient_id', values.patient_id)
          .eq('completed', false);

        if (ordersError) throw ordersError;

        const ordersWithSessions = patientOrders?.filter(order => order.sessions_used < order.total_sessions) || [];

        if (ordersWithSessions.length > 0) {
          toast({
            title: "Orden médica requerida",
            description: "Este paciente tiene órdenes médicas vigentes. Selecciona una orden para agendar la cita.",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Validar que la orden seleccionada tenga sesiones disponibles
        const selectedOrder = medicalOrders.find(order => order.id === medicalOrderId);
        if (!selectedOrder) {
          toast({
            title: "Error",
            description: "La orden médica seleccionada no es válida.",
            variant: "destructive",
          });
          return;
        }

        if (selectedOrder.sessions_used >= selectedOrder.total_sessions) {
          toast({
            title: "Sin sesiones disponibles",
            description: "La orden médica seleccionada no tiene sesiones disponibles.",
            variant: "destructive",
          });
          return;
        }
      }

      // Validar que no exista una cita duplicada (mismo paciente, doctor, día y hora)
      const { data: existingAppointment, error: duplicateError } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', values.patient_id)
        .eq('doctor_id', values.doctor_id)
        .eq('appointment_date', format(values.appointment_date, 'yyyy-MM-dd'))
        .eq('appointment_time', values.appointment_time)
        .neq('status', 'cancelled')
        .maybeSingle();

      if (duplicateError) throw duplicateError;

      if (existingAppointment) {
        toast({
          title: "Cita duplicada",
          description: "Ya existe una cita programada para este paciente con el mismo profesional en la fecha y hora seleccionada.",
          variant: "destructive",
        });
        return;
      }

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

      // Si hay una orden médica, incrementar sessions_used
      if (medicalOrderId) {
        const selectedOrder = medicalOrders.find(order => order.id === medicalOrderId);
        if (selectedOrder) {
          const newSessionsUsed = selectedOrder.sessions_used + 1;
          const isCompleted = newSessionsUsed >= selectedOrder.total_sessions;

          const { error: updateError } = await supabase
            .from('medical_orders')
            .update({ 
              sessions_used: newSessionsUsed,
              completed: isCompleted
            })
            .eq('id', medicalOrderId);

          if (updateError) {
            console.error('Error updating medical order:', updateError);
          } else {
            toast({
              title: "Éxito",
              description: `Cita agendada. Sesiones restantes: ${selectedOrder.total_sessions - newSessionsUsed}`,
            });
          }
        }
      } else {
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
                       <SelectItem value="none">Sin orden médica</SelectItem>
                       {medicalOrders.map((order) => {
                         const sessionsRemaining = order.total_sessions - order.sessions_used;
                         const isOrderComplete = sessionsRemaining <= 0;
                         
                         return (
                           <SelectItem 
                             key={order.id} 
                             value={order.id}
                             disabled={isOrderComplete}
                           >
                             {order.description.substring(0, 50)}...
                             <span className="text-sm text-muted-foreground ml-2">
                               {order.doctor_name && `Dr. ${order.doctor_name} - `}
                               {sessionsRemaining} sesión{sessionsRemaining !== 1 ? 'es' : ''} restante{sessionsRemaining !== 1 ? 's' : ''}
                             </span>
                           </SelectItem>
                         );
                       })}
                     </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      console.log('Botón + clickeado, paciente seleccionado:', form.watch('patient_id'));
                      setIsNewOrderDialogOpen(true);
                    }}
                    disabled={!form.watch('patient_id')}
                    title={!form.watch('patient_id') ? 'Primero selecciona un paciente' : 'Crear nueva orden médica'}
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
          <DialogDescription>
            Registrar un nuevo paciente en el sistema
          </DialogDescription>
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
          <DialogDescription>
            Crear una nueva orden médica para el paciente seleccionado
          </DialogDescription>
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