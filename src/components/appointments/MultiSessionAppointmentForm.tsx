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
import { cn, formatDateToISO, validateAppointmentDate, validateDateIntegrity, logAppointmentDebug, parseDateOnly } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import PendingDocumentAlert from './PendingDocumentAlert';

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
  document_status: 'pendiente' | 'completa';
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
  const [isSubmitting, setIsSubmitting] = useState(false); // Anti-doble submit
  const { profile } = useAuth();
  const { toast } = useToast();
  const { currentOrgId } = useOrganizationContext();

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
      // Fetch doctors with separate queries to avoid RLS issues
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('id, profile_id, specialty_id, work_start_time, work_end_time, appointment_duration, work_days')
        .eq('is_active', true);

      if (doctorsError) throw doctorsError;

      if (!doctorsData || doctorsData.length === 0) {
        setDoctors([]);
        return;
      }

      // Get profiles and specialties separately
      const profileIds = doctorsData.map(d => d.profile_id);
      const specialtyIds = doctorsData.map(d => d.specialty_id);

      const [profilesResult, specialtiesResult] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name').in('id', profileIds),
        supabase.from('specialties').select('id, name, color').in('id', specialtyIds)
      ]);

      const profiles = profilesResult.data || [];
      const specialties = specialtiesResult.data || [];

      // Combine data
      const enrichedDoctors = doctorsData.map(doctor => {
        const profile = profiles.find(p => p.id === doctor.profile_id);
        const specialty = specialties.find(s => s.id === doctor.specialty_id);
        
        return {
          id: doctor.id,
          work_start_time: doctor.work_start_time,
          work_end_time: doctor.work_end_time,
          appointment_duration: doctor.appointment_duration,
          work_days: doctor.work_days,
          profile: {
            first_name: profile?.first_name || 'N/A',
            last_name: profile?.last_name || 'N/A'
          },
          specialty: {
            name: specialty?.name || 'N/A',
            color: specialty?.color || '#3B82F6'
          }
        };
      });

      setDoctors(enrichedDoctors);
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
      // Fetch patients with separate queries to avoid RLS issues
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('id, profile_id')
        .eq('is_active', true);

      if (patientsError) throw patientsError;

      if (!patientsData || patientsData.length === 0) {
        setPatients([]);
        return;
      }

      // Get profiles separately
      const profileIds = patientsData.map(p => p.profile_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, dni, email')
        .in('id', profileIds)
        .order('first_name', { ascending: true });

      if (profilesError) throw profilesError;

      // Combine data
      const enrichedPatients = patientsData.map(patient => {
        const profile = profiles?.find(p => p.id === patient.profile_id);
        
        return {
          id: patient.id,
          profile: {
            first_name: profile?.first_name || 'N/A',
            last_name: profile?.last_name || 'N/A',
            dni: profile?.dni || null,
            email: profile?.email || 'N/A'
          }
        };
      });

      setPatients(enrichedPatients);
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
      // Use new function that only returns orders with available sessions
      const { data: ordersData, error: ordersError } = await supabase
        .rpc('get_medical_orders_with_availability', {
          patient_id_param: patientId
        });

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setMedicalOrders([]);
        return;
      }

      // Get doctor information separately to maintain compatibility
      const doctorIds = ordersData.map(o => o.doctor_id).filter(Boolean);
      let doctorProfiles = [];
      
      if (doctorIds.length > 0) {
        const { data: doctorsResult, error: doctorsError } = await supabase
          .from('doctors')
          .select(`
            id,
            profile:profiles(first_name, last_name)
          `)
          .in('id', doctorIds);

        if (!doctorsError && doctorsResult) {
          doctorProfiles = doctorsResult;
        }
      }

      // Transform to expected interface
      const transformedOrders = ordersData.map(order => {
        const doctorInfo = doctorProfiles.find(d => d.id === order.doctor_id);
        
        return {
          id: order.id,
          description: order.description,
          instructions: order.instructions || null,
          document_status: (order.document_status as 'pendiente' | 'completa') || 'pendiente',
          sessions_count: order.sessions_remaining, // Available sessions for scheduling
          doctor: {
            profile: {
              first_name: doctorInfo?.profile?.first_name || 'N/A',
              last_name: doctorInfo?.profile?.last_name || 'N/A'
            }
          }
        };
      });

      setMedicalOrders(transformedOrders);
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
        .eq('appointment_date', formatDateToISO(selectedDate))
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
        .filter(session => formatDateToISO(session.date) === formatDateToISO(selectedDate))
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

  const addSession = async () => {
    if (!selectedDate || !selectedTime || !form.watch('doctor_id')) {
      toast({
        title: "Error",
        description: "Selecciona fecha, hora y doctor antes de agregar la sesión",
        variant: "destructive",
      });
      return;
    }

    // === VALIDACIONES PREVENTIVAS PARA SESIÓN INDIVIDUAL ===
    
    // 1. Validar rango de fecha
    const dateValidation = validateAppointmentDate(selectedDate);
    if (!dateValidation.isValid) {
      toast({
        title: "Fecha inválida",
        description: dateValidation.error,
        variant: "destructive",
      });
      return;
    }

    // 2. Validar integridad de fecha
    const formattedDate = formatDateToISO(selectedDate);
    const integrityCheck = validateDateIntegrity(selectedDate, formattedDate);
    
    // 3. Logging para debugging
    logAppointmentDebug('Agregando sesión individual', {
      selectedDate: selectedDate,
      formattedDate: formattedDate,
      appointmentTime: selectedTime,
      doctorId: form.watch('doctor_id'),
      patientId: form.watch('patient_id'),
    });

    // 4. Alertar discrepancias
    if (!integrityCheck.isValid && integrityCheck.warning) {
      console.warn(`⚠️ ${integrityCheck.warning}`);
    }

    // Verificar duplicados ANTES de agregar
    const patientId = form.watch('patient_id');
    const doctorId = form.watch('doctor_id');
    const dateStr = formattedDate; // Usar fecha ya validada
    
    // Verificar si ya existe esta sesión en lo programado
    const alreadyScheduled = scheduledSessions.some(session => 
      formatDateToISO(session.date) === dateStr && session.time === selectedTime
    );
    
    if (alreadyScheduled) {
      toast({
        title: "Sesión duplicada",
        description: "Ya has programado una sesión para esta fecha y hora",
        variant: "destructive",
      });
      return;
    }

    // Verificar si ya existe en la base de datos
    try {
      const { data: existingAppointment, error } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', patientId)
        .eq('doctor_id', doctorId)
        .eq('appointment_date', dateStr)
        .eq('appointment_time', selectedTime)
        .in('status', ['scheduled', 'confirmed', 'in_progress'])
        .maybeSingle();

      if (error) throw error;

      if (existingAppointment) {
        toast({
          title: "Cita ya existe",
          description: "Ya existe una cita programada para este paciente en esta fecha y hora",
          variant: "destructive",
        });
        return;
      }

      // Si no hay duplicados, agregar la sesión
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
    } catch (error) {
      console.error('Error checking duplicates:', error);
      toast({
        title: "Error",
        description: "Error al verificar duplicados. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
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
    // Anti-doble submit: prevenir múltiples envíos concurrentes
    if (isSubmitting) return;
    
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
      setIsSubmitting(true);
      setLoading(true);

      // === VALIDACIONES PREVENTIVAS PARA MÚLTIPLES SESIONES ===
      
      // 1. Validar todas las fechas y detectar anomalías
      const appointmentValidations = scheduledSessions.map((session, index) => {
        const dateValidation = validateAppointmentDate(session.date);
        const formattedDate = formatDateToISO(session.date);
        const integrityCheck = validateDateIntegrity(session.date, formattedDate);
        
        return {
          sessionIndex: index + 1,
          selectedDate: session.date,
          finalDate: formattedDate,
          time: session.time,
          dateValidation,
          integrityCheck
        };
      });

      // 2. Verificar validaciones de fechas
      const invalidDates = appointmentValidations.filter(v => !v.dateValidation.isValid);
      if (invalidDates.length > 0) {
        toast({
          title: "Fechas inválidas",
          description: `Sesión ${invalidDates[0].sessionIndex}: ${invalidDates[0].dateValidation.error}`,
          variant: "destructive",
        });
        return;
      }

      // 3. Logging detallado para debugging
      logAppointmentDebug('Creación de turnos múltiples', {
        patientId: values.patient_id,
        doctorId: values.doctor_id,
        organizationId: currentOrgId,
      });

      appointmentValidations.forEach((validation, index) => {
        logAppointmentDebug(`Sesión ${validation.sessionIndex}`, {
          selectedDate: validation.selectedDate,
          formattedDate: validation.finalDate,
          appointmentTime: validation.time,
        });

        // 4. Alertar discrepancias individuales
        if (!validation.integrityCheck.isValid && validation.integrityCheck.warning) {
          console.warn(`⚠️ Sesión ${validation.sessionIndex}: ${validation.integrityCheck.warning}`);
        }
      });

      // 5. Detectar anomalías en el patrón completo de sesiones
      const appointmentAnomalies = appointmentValidations.map(v => ({
        selectedDate: v.selectedDate,
        finalDate: v.finalDate,
        patientId: values.patient_id
      }));

      const anomalies = require('@/lib/utils').detectAppointmentAnomalies(appointmentAnomalies);
      if (anomalies.length > 0) {
        console.warn('⚠️ ANOMALÍAS DETECTADAS EN SESIONES MÚLTIPLES:', anomalies);
      }

      // Preparar datos para la RPC transaccional usando fechas validadas
      const appointmentData = appointmentValidations.map((validation, index) => ({
        patient_id: values.patient_id,
        doctor_id: values.doctor_id,
        appointment_date: validation.finalDate, // Usar fecha ya validada
        appointment_time: validation.time,
        reason: values.reason,
        status: 'scheduled',
        notes: `Sesión ${validation.sessionIndex} de ${values.sessions_count}`,
        duration_minutes: 30
      }));

      // Usar la nueva RPC transaccional
      const medicalOrderId = values.medical_order_id !== 'none' ? values.medical_order_id : null;
      const { data: results, error: rpcError } = await supabase
        .rpc('create_appointments_with_order', {
          appointments_data: appointmentData,
          medical_order_id_param: medicalOrderId,
          assigned_by_param: profile?.id || null
        });

      if (rpcError) throw rpcError;

      // Contar resultados exitosos y conflictos
      const successful = results?.filter(r => r.was_created).length || 0;
      const conflicts = results?.filter(r => !r.was_created).length || 0;

      if (successful === 0) {
        toast({
          title: "Todas las citas ya existen",
          description: "Todas las sesiones programadas ya estaban creadas previamente",
          variant: "destructive",
        });
        return;
      }

      let message = `Se crearon ${successful} citas correctamente`;
      if (conflicts > 0) {
        message += ` (${conflicts} ya existían y se omitieron)`;
      }
      if (medicalOrderId) {
        message += ' y se vincularon a la orden médica';
      }

      toast({
        title: "Éxito",
        description: message,
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
      setIsSubmitting(false);
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
            disabled={loading || isSubmitting || scheduledSessions.length !== form.watch('sessions_count')}
          >
            {(loading || isSubmitting) ? 'Creando citas...' : `Crear ${scheduledSessions.length} Citas`}
          </Button>
        </form>
      </Form>
    </div>
  );
}