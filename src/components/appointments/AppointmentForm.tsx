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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, Plus, Search, X, Calendar as CalendarDays } from 'lucide-react';
import { format, addDays, isSameDay, startOfWeek, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import PatientForm from '@/components/patients/PatientForm';
import MedicalOrderForm from './MedicalOrderForm';
import PendingDocumentAlert from './PendingDocumentAlert';

const formSchema = z.object({
  patient_id: z.string().min(1, 'Selecciona un paciente'),
  medical_order_id: z.string().optional(),
  doctor_id: z.string().min(1, 'Selecciona un doctor'),
  appointment_date: z.date({
    required_error: 'Selecciona una fecha',
  }),
  appointment_time: z.string().min(1, 'Selecciona una hora'),
  reason: z.string().min(1, 'Describe el motivo de la consulta'),
  is_recurring: z.boolean().default(false),
  sessions_count: z.number().min(1, 'Debe tener al menos 1 sesión').max(20, 'Máximo 20 sesiones').optional(),
  selected_days: z.array(z.string()).optional(),
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
  document_status: 'pendiente' | 'completa';
}

interface RecurringAppointment {
  date: Date;
  time: string;
  sessionNumber: number;
  conflict?: boolean;
  conflictReason?: string;
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
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [appointmentSummary, setAppointmentSummary] = useState<any>(null);
  const [recurringAppointments, setRecurringAppointments] = useState<RecurringAppointment[]>([]);
  const { profile } = useAuth();
  const { toast } = useToast();

  const weekDays = [
    { key: 'monday', label: 'Lun', value: 1 },
    { key: 'tuesday', label: 'Mar', value: 2 },
    { key: 'wednesday', label: 'Mié', value: 3 },
    { key: 'thursday', label: 'Jue', value: 4 },
    { key: 'friday', label: 'Vie', value: 5 },
    { key: 'saturday', label: 'Sáb', value: 6 },
    { key: 'sunday', label: 'Dom', value: 0 },
  ];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_id: '',
      medical_order_id: 'none',
      doctor_id: selectedDoctor || '',
      appointment_date: selectedDate || undefined,
      appointment_time: selectedTime || '',
      reason: '',
      is_recurring: false,
      sessions_count: 1,
      selected_days: [],
    },
  });

  const isRecurring = form.watch('is_recurring');

  useEffect(() => {
    fetchDoctors();
    fetchPatients();
    fetchMedicalOrders();
  }, []);

  useEffect(() => {
    if (form.watch('doctor_id') && form.watch('appointment_date') && doctors.length > 0) {
      fetchAvailableSlots();
    }
  }, [form.watch('doctor_id'), form.watch('appointment_date'), doctors]);

  useEffect(() => {
    if (form.watch('patient_id')) {
      fetchMedicalOrders();
    }
  }, [form.watch('patient_id')]);

  useEffect(() => {
    if (isRecurring) {
      generateRecurringAppointments();
    } else {
      setRecurringAppointments([]);
    }
  }, [form.watch('appointment_date'), form.watch('appointment_time'), form.watch('sessions_count'), form.watch('selected_days'), form.watch('doctor_id'), isRecurring]);

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
          sessions_used,
          document_status,
          created_at
        `)
        .eq('patient_id', patientId)
        .eq('completed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Solo mostrar órdenes que tengan sesiones disponibles
      const availableOrders = (data || []).filter(order => order.sessions_used < order.total_sessions);
      setMedicalOrders(availableOrders.map(order => ({
        ...order,
        document_status: (order.document_status as 'pendiente' | 'completa') || 'pendiente'
      })));
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

  const generateRecurringAppointments = async () => {
    const doctorId = form.watch('doctor_id');
    const startDate = form.watch('appointment_date');
    const time = form.watch('appointment_time');
    const sessionsCount = form.watch('sessions_count');
    const selectedDays = form.watch('selected_days');

    if (!doctorId || !startDate || !time || !sessionsCount || !selectedDays?.length) {
      setRecurringAppointments([]);
      return;
    }

    const appointments: RecurringAppointment[] = [];
    let currentDate = new Date(startDate);
    let sessionNumber = 1;
    let attempts = 0;
    const maxAttempts = 365; // Prevent infinite loops

    while (sessionNumber <= sessionsCount && attempts < maxAttempts) {
      const dayOfWeek = currentDate.getDay();
      const dayKey = weekDays.find(d => d.value === dayOfWeek)?.key;
      
      if (dayKey && selectedDays.includes(dayKey)) {
        // Check for conflicts
        const conflict = await checkAppointmentConflict(doctorId, currentDate, time);
        
        appointments.push({
          date: new Date(currentDate),
          time,
          sessionNumber,
          conflict: conflict.hasConflict,
          conflictReason: conflict.reason,
        });
        
        sessionNumber++;
      }
      
      currentDate = addDays(currentDate, 1);
      attempts++;
    }

    setRecurringAppointments(appointments);
  };

  const checkAppointmentConflict = async (doctorId: string, date: Date, time: string) => {
    try {
      const { data: existingAppointments, error } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', format(date, 'yyyy-MM-dd'))
        .neq('status', 'cancelled');

      if (error) throw error;

      const timeSlotCount = (existingAppointments || []).filter(apt => apt.appointment_time === time).length;
      
      if (timeSlotCount >= 3) {
        return { 
          hasConflict: true, 
          reason: 'Horario completo (3 pacientes máximo)' 
        };
      }

      return { hasConflict: false };
    } catch (error) {
      console.error('Error checking conflicts:', error);
      return { 
        hasConflict: true, 
        reason: 'Error verificando disponibilidad' 
      };
    }
  };

  const handleShowSummary = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);

      // If it's recurring appointments, validate and create them
      if (values.is_recurring) {
        await handleRecurringSubmit(values);
        return;
      }

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
        // Validar que la orden seleccionada tenga sesiones disponibles con datos frescos
        const { data: currentOrder, error: orderError } = await supabase
          .from('medical_orders')
          .select('id, total_sessions, sessions_used, completed, patient_id')
          .eq('id', medicalOrderId)
          .single();

        if (orderError) {
          toast({
            title: "Error",
            description: "No se pudo verificar la orden médica.",
            variant: "destructive",
          });
          return;
        }

        if (!currentOrder) {
          toast({
            title: "Error",
            description: "La orden médica seleccionada no es válida.",
            variant: "destructive",
          });
          return;
        }

        // Validar que la orden pertenezca al paciente seleccionado
        if (currentOrder.patient_id !== values.patient_id) {
          toast({
            title: "Error de asignación",
            description: "Esta orden médica está asignada a otro paciente y no puede utilizarse.",
            variant: "destructive",
          });
          return;
        }

        if (currentOrder.completed || currentOrder.sessions_used >= currentOrder.total_sessions) {
          toast({
            title: "Sin sesiones disponibles",
            description: "La orden médica seleccionada no tiene sesiones disponibles.",
            variant: "destructive",
          });
          return;
        }
      }

      // Validar que no exista una cita duplicada
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

      // Preparar el resumen
      const selectedPatient = patients.find(p => p.id === values.patient_id);
      const selectedDoctor = doctors.find(d => d.id === values.doctor_id);
      const selectedOrder = medicalOrderId ? medicalOrders.find(o => o.id === medicalOrderId) : null;

      setAppointmentSummary({
        values,
        patient: selectedPatient,
        doctor: selectedDoctor,
        order: selectedOrder,
      });

      setIsConfirmDialogOpen(true);
    } catch (error) {
      console.error('Error validating appointment:', error);
      toast({
        title: "Error",
        description: "Error al validar la cita",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecurringSubmit = async (values: z.infer<typeof formSchema>) => {
    if (recurringAppointments.length === 0) {
      toast({
        title: "Error",
        description: "No hay citas programadas para crear",
        variant: "destructive",
      });
      return;
    }

    const conflictsExist = recurringAppointments.some(apt => apt.conflict);
    
    if (conflictsExist) {
      toast({
        title: "Conflictos detectados",
        description: "Hay conflictos en algunas citas. Revisa la vista previa.",
        variant: "destructive",
      });
      return;
    }

    const medicalOrderId = values.medical_order_id === 'none' ? null : values.medical_order_id;

    // Validate medical order sessions
    if (medicalOrderId) {
      const selectedOrder = medicalOrders.find(order => order.id === medicalOrderId);
      if (selectedOrder) {
        const availableSessions = selectedOrder.total_sessions - selectedOrder.sessions_used;
        if (recurringAppointments.length > availableSessions) {
          toast({
            title: "Sin sesiones suficientes",
            description: `La orden médica solo tiene ${availableSessions} sesiones disponibles, pero intentas agendar ${recurringAppointments.length}`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    try {
      const appointmentsToCreate = recurringAppointments.map((apt) => ({
        patient_id: values.patient_id,
        doctor_id: values.doctor_id,
        appointment_date: format(apt.date, 'yyyy-MM-dd'),
        appointment_time: apt.time,
        reason: values.reason,
        status: 'scheduled' as const,
        notes: `Sesión ${apt.sessionNumber} de ${recurringAppointments.length} (recurrente)`,
      }));

      const { error } = await supabase
        .from('appointments')
        .insert(appointmentsToCreate);

      if (error) throw error;

      // Update medical order sessions if applicable
      if (medicalOrderId) {
        const selectedOrder = medicalOrders.find(order => order.id === medicalOrderId);
        if (selectedOrder) {
          const newSessionsUsed = selectedOrder.sessions_used + recurringAppointments.length;
          const isCompleted = newSessionsUsed >= selectedOrder.total_sessions;

          await supabase
            .from('medical_orders')
            .update({ 
              sessions_used: newSessionsUsed,
              completed: isCompleted
            })
            .eq('id', medicalOrderId);
        }
      }

      toast({
        title: "Éxito",
        description: `Se crearon ${recurringAppointments.length} citas recurrentes correctamente`,
      });

      form.reset();
      setRecurringAppointments([]);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating recurring appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron crear las citas recurrentes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
        // Validar que la orden seleccionada tenga sesiones disponibles con datos frescos
        const { data: currentOrder, error: orderError } = await supabase
          .from('medical_orders')
          .select('id, total_sessions, sessions_used, completed')
          .eq('id', medicalOrderId)
          .eq('patient_id', values.patient_id)
          .maybeSingle();

        if (orderError) {
          console.error('Error al verificar orden médica:', orderError);
          toast({
            title: "Error",
            description: "No se pudo verificar la orden médica.",
            variant: "destructive",
          });
          return;
        }

        if (!currentOrder) {
          toast({
            title: "Error",
            description: "La orden médica seleccionada no existe o no pertenece a este paciente.",
            variant: "destructive",
          });
          return;
        }

        if (currentOrder.completed || currentOrder.sessions_used >= currentOrder.total_sessions) {
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
      <ScrollArea className="max-h-[75vh] pr-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleShowSummary)} className="space-y-4">
            {/* ... keep existing code (all form fields) */}
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between"
                        >
                          {field.value 
                            ? patients.find(p => p.id === field.value)
                              ? `${patients.find(p => p.id === field.value)?.profile.first_name} ${patients.find(p => p.id === field.value)?.profile.last_name}`
                              : 'Seleccionar paciente'
                            : 'Seleccionar paciente'
                          }
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Buscar paciente..." />
                          <CommandList>
                            <CommandEmpty>No se encontraron pacientes.</CommandEmpty>
                            <CommandGroup>
                              {patients.map((patient) => (
                                <CommandItem
                                  key={patient.id}
                                  value={`${patient.profile.first_name} ${patient.profile.last_name} ${patient.profile.dni}`}
                                  onSelect={() => field.onChange(patient.id)}
                                >
                                  {patient.profile.first_name} {patient.profile.last_name}
                                  {patient.profile.dni && (
                                    <span className="text-sm text-muted-foreground ml-2">
                                      (DNI: {patient.profile.dni})
                                    </span>
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
                          {medicalOrders.length === 0 && form.watch('patient_id') && (
                            <div className="text-sm text-muted-foreground p-2">
                              No hay órdenes médicas disponibles para este paciente
                            </div>
                          )}
                          {medicalOrders.map((order) => {
                            const sessionsRemaining = order.total_sessions - order.sessions_used;
                            
                            return (
                              <SelectItem 
                                key={order.id} 
                                value={order.id}
                              >
                                <div className="w-full">
                                  <div className="font-medium">
                                    {order.description.length > 45 
                                      ? `${order.description.substring(0, 45)}...` 
                                      : order.description
                                    }
                                  </div>
                                  <div className="text-sm text-muted-foreground flex justify-between">
                                    <span>
                                      {order.doctor_name && `Dr. ${order.doctor_name}`}
                                    </span>
                                    <span className="font-semibold text-primary">
                                      {sessionsRemaining} sesión{sessionsRemaining !== 1 ? 'es' : ''} disponible{sessionsRemaining !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>
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

            {/* Show pending document alert if selected order has pending status */}
            {form.watch('medical_order_id') !== 'none' && (() => {
              const selectedOrderId = form.watch('medical_order_id');
              const selectedOrder = medicalOrders.find(o => o.id === selectedOrderId);
              const selectedPatient = patients.find(p => p.id === form.watch('patient_id'));
              
              if (selectedOrder?.document_status === 'pendiente') {
                return (
                  <PendingDocumentAlert
                    medicalOrderId={selectedOrder.id}
                    patientName={selectedPatient ? `${selectedPatient.profile.first_name} ${selectedPatient.profile.last_name}` : ''}
                    orderDescription={selectedOrder.description}
                    className="mb-4"
                  />
                );
              }
              return null;
            })()}

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
                          "w-full justify-start text-left font-normal",
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
                  <PopoverContent 
                    className="w-auto p-0 z-50" 
                    align="start"
                    sideOffset={4}
                  >
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today;
                      }}
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

          {/* Recurring Appointments Section */}
          <FormField
            control={form.control}
            name="is_recurring"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Programar turnos múltiples
                  </FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Agenda varias citas de forma recurrente para tratamientos prolongados
                  </p>
                </div>
              </FormItem>
            )}
          />

          {isRecurring && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
              <h3 className="font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Configuración de turnos recurrentes
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sessions_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad de sesiones</FormLabel>
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
                  name="selected_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Días de la semana</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {weekDays.map((day) => (
                          <div key={day.key} className="flex items-center space-x-2">
                            <Checkbox
                              id={day.key}
                              checked={field.value?.includes(day.key) || false}
                              onCheckedChange={(checked) => {
                                const currentDays = field.value || [];
                                if (checked) {
                                  field.onChange([...currentDays, day.key]);
                                } else {
                                  field.onChange(currentDays.filter(d => d !== day.key));
                                }
                              }}
                            />
                            <label
                              htmlFor={day.key}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {day.label}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {recurringAppointments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Vista previa de citas ({recurringAppointments.length})</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {recurringAppointments.map((apt, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex items-center justify-between p-2 rounded border text-sm",
                          apt.conflict 
                            ? "border-destructive bg-destructive/10" 
                            : "border-border bg-background"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{apt.sessionNumber}</Badge>
                          <span>
                            {format(apt.date, "dd/MM/yyyy", { locale: es })} - {apt.time.substring(0, 5)}
                          </span>
                        </div>
                        {apt.conflict && (
                          <Badge variant="destructive" className="text-xs">
                            {apt.conflictReason}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Validando...' : isRecurring ? `Crear ${recurringAppointments.length} Citas` : 'Revisar y Confirmar'}
          </Button>
        </form>
      </Form>
      </ScrollArea>

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Orden Médica</DialogTitle>
          <DialogDescription>
            Crear una nueva orden médica para el paciente seleccionado
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <MedicalOrderForm 
            onSuccess={handleNewOrderCreated} 
            onCancel={() => setIsNewOrderDialogOpen(false)}
            selectedPatient={form.watch('patient_id')}
          />
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar Cita Médica</DialogTitle>
          <DialogDescription>
            Revisa los datos de la cita antes de confirmar
          </DialogDescription>
        </DialogHeader>
        {appointmentSummary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-sm">Paciente</h4>
                <p className="text-sm text-muted-foreground">
                  {appointmentSummary.patient?.profile.first_name} {appointmentSummary.patient?.profile.last_name}
                  {appointmentSummary.patient?.profile.dni && (
                    <span className="block">DNI: {appointmentSummary.patient.profile.dni}</span>
                  )}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Profesional</h4>
                <p className="text-sm text-muted-foreground">
                  Dr. {appointmentSummary.doctor?.profile.first_name} {appointmentSummary.doctor?.profile.last_name}
                  <span className="block">{appointmentSummary.doctor?.specialty.name}</span>
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-sm">Fecha y Hora</h4>
                <p className="text-sm text-muted-foreground">
                  {format(appointmentSummary.values.appointment_date, "PPP", { locale: es })}
                  <span className="block">{appointmentSummary.values.appointment_time.substring(0, 5)}</span>
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Orden Médica</h4>
                <p className="text-sm text-muted-foreground">
                  {appointmentSummary.order ? (
                    <>
                      {appointmentSummary.order.description.substring(0, 40)}...
                      <span className="block">
                        Sesiones restantes: {appointmentSummary.order.total_sessions - appointmentSummary.order.sessions_used - 1}
                      </span>
                    </>
                  ) : (
                    'Sin orden médica'
                  )}
                </p>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm">Motivo de la consulta</h4>
              <p className="text-sm text-muted-foreground">
                {appointmentSummary.values.reason}
              </p>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsConfirmDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  setIsConfirmDialogOpen(false);
                  onSubmit(appointmentSummary.values);
                }}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Confirmando...' : 'Confirmar Cita'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}