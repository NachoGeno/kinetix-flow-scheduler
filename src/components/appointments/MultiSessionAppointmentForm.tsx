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
  medical_order_id: z.string().min(1, 'Debe seleccionar una orden médica - Es obligatorio'), // OBLIGATORIO
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
  sessions_remaining?: number;
  urgent?: boolean;
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
  preselectedMedicalOrder?: MedicalOrder;
}

export default function MultiSessionAppointmentForm({ onSuccess, preselectedMedicalOrder }: MultiSessionAppointmentFormProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicalOrders, setMedicalOrders] = useState<MedicalOrder[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    isValidating: boolean;
    error?: string;
    warning?: string;
  }>({ isValidating: false });
  
  const { profile } = useAuth();
  const { currentOrgId } = useOrganizationContext();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_id: '',
      medical_order_id: preselectedMedicalOrder?.id || '', // ELIMINADO 'none' - debe ser obligatorio
      doctor_id: '',
      reason: preselectedMedicalOrder?.description || '',
      sessions_count: preselectedMedicalOrder?.sessions_count || 1,
    },
  });

  useEffect(() => {
    fetchDoctors();
    fetchPatients();
  }, []);

  useEffect(() => {
    if (form.watch('doctor_id') && selectedDate) {
      fetchAvailableSlots();
    }
  }, [form.watch('doctor_id'), selectedDate]);

  useEffect(() => {
    if (form.watch('patient_id')) {
      fetchMedicalOrders(form.watch('patient_id'));
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

  const fetchMedicalOrders = async (patientId: string) => {
    try {
      setValidationStatus({ isValidating: true });
      
      const { data: ordersData, error: ordersError } = await supabase
        .rpc('get_medical_orders_with_availability', {
          patient_id_param: patientId
        });

      if (ordersError) {
        console.error('Error fetching medical orders:', ordersError);
      toast({
        title: "Error",
        description: "Error al cargar las órdenes médicas",
        variant: "destructive",
      });
        setValidationStatus({ 
          isValidating: false, 
          error: 'Error al cargar las órdenes médicas' 
        });
        return;
      }

      console.log(`AUDIT_LOG: Medical orders for patient ${patientId}:`, ordersData);

      if (!ordersData || ordersData.length === 0) {
        setMedicalOrders([]);
        setValidationStatus({ 
          isValidating: false,
          error: 'Este paciente no tiene órdenes médicas con sesiones disponibles para múltiples turnos'
        });
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
          sessions_remaining: order.sessions_remaining,
          urgent: order.urgent || false,
          doctor: {
            profile: {
              first_name: doctorInfo?.profile?.first_name || 'N/A',
              last_name: doctorInfo?.profile?.last_name || 'N/A'
            }
          }
        };
      });

      setMedicalOrders(transformedOrders);

      // If there's a preselected order, ensure it's in the list and select it
      if (preselectedMedicalOrder) {
        const orderExists = transformedOrders?.find(order => order.id === preselectedMedicalOrder.id);
        if (orderExists) {
          form.setValue('medical_order_id', preselectedMedicalOrder.id);
          console.log(`AUDIT_LOG: Preseleccionando orden ${preselectedMedicalOrder.id}`);
          setValidationStatus({ 
            isValidating: false,
            warning: `Orden preseleccionada: ${orderExists.description} (${orderExists.sessions_remaining} sesiones disponibles)`
          });
        } else {
          setValidationStatus({ 
            isValidating: false,
            error: 'La orden médica preseleccionada ya no está disponible'
          });
        }
      } else {
        // Auto-asignación inteligente para múltiples sesiones
        if (transformedOrders && transformedOrders.length === 1) {
          const singleOrder = transformedOrders[0];
          form.setValue('medical_order_id', singleOrder.id);
          console.log(`AUDIT_LOG: Auto-asignando orden única ${singleOrder.id} para múltiples sesiones`);
          setValidationStatus({ 
            isValidating: false,
            warning: `Auto-asignado a orden: ${singleOrder.description} (${singleOrder.sessions_remaining} sesiones disponibles)`
          });
        } else if (transformedOrders && transformedOrders.length > 1) {
          setValidationStatus({ 
            isValidating: false,
            warning: `Seleccione una de las ${transformedOrders.length} órdenes médicas con suficientes sesiones disponibles`
          });
        }
      }
    } catch (error) {
      console.error('Error fetching medical orders:', error);
      toast({
        title: "Error",
        description: "Error al cargar las órdenes médicas",
        variant: "destructive",
      });
      setValidationStatus({ 
        isValidating: false, 
        error: 'Error inesperado al cargar las órdenes médicas' 
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

    // Check authentication and organization
    if (!profile) {
      toast({
        title: "Error de autenticación",
        description: "Usuario no autenticado. Intente cerrar sesión y volver a entrar.",
        variant: "destructive",
      });
      return;
    }

    if (!currentOrgId) {
      toast({
        title: "Error de organización",
        description: "Organización no encontrada. Contacte al administrador.",
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

    // VALIDACIÓN CRÍTICA: Orden médica es OBLIGATORIA
    if (!values.medical_order_id) {
      toast({
        title: "Error",
        description: "Debe seleccionar una orden médica. Todos los turnos requieren una orden médica asociada.",
        variant: "destructive",
      });
      return;
    }

    // Validar capacidad usando la nueva función antes de crear
    try {
      const { data: validationResult, error: validationError } = await supabase.rpc(
        'validate_order_assignment_capacity',
        {
          order_id_param: values.medical_order_id,
          requested_sessions: scheduledSessions.length
        }
      );

      if (validationError) {
        console.error('AUDIT_LOG: Error validando capacidad para múltiples sesiones:', validationError);
        toast({
          title: "Error",
          description: "Error validando la capacidad de la orden médica",
          variant: "destructive",
        });
        return;
      }

      if (!(validationResult as any).valid) {
        console.warn(`AUDIT_LOG: Validación fallida para ${scheduledSessions.length} sesiones:`, validationResult);
        toast({
          title: "Error",
          description: (validationResult as any).message || 'La orden médica no tiene capacidad suficiente para todas las sesiones',
          variant: "destructive",
        });
        return;
      }

      console.log(`AUDIT_LOG: Validación exitosa para ${scheduledSessions.length} sesiones en orden ${values.medical_order_id}:`, validationResult);
    } catch (error) {
      console.error('AUDIT_LOG: Error inesperado validando capacidad múltiple:', error);
      toast({
        title: "Error",
        description: "Error validando la orden médica",
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

        logAppointmentDebug(`Sesión múltiple ${index + 1}/${scheduledSessions.length}`, {
          selectedDate: session.date,
          formattedDate: formattedDate,
          appointmentTime: session.time,
          doctorId: values.doctor_id,
          patientId: values.patient_id,
        });

        if (!dateValidation.isValid) {
          throw new Error(`Fecha inválida en sesión ${session.sessionNumber}: ${dateValidation.error}`);
        }

        if (!integrityCheck.isValid && integrityCheck.warning) {
          console.warn(`⚠️ Sesión ${session.sessionNumber}: ${integrityCheck.warning}`);
        }

        return {
          session,
          formattedDate,
          dateValidation,
          integrityCheck
        };
      });

      console.log(`AUDIT_LOG: Creando ${scheduledSessions.length} sesiones múltiples con orden ${values.medical_order_id}`);

      // Prepare appointments data with validated dates
      const appointmentsData = appointmentValidations.map((validation) => ({
        patient_id: values.patient_id,
        doctor_id: values.doctor_id,
        appointment_date: validation.formattedDate, // Usar fecha ya validada
        appointment_time: validation.session.time,
        reason: values.reason,
        status: 'scheduled',
        notes: `Sesión ${validation.session.sessionNumber} de ${scheduledSessions.length} - Orden: ${values.medical_order_id}`,
      }));

      // Create all appointments using the strict RPC function
      const { data: results, error } = await supabase.rpc('create_appointments_with_order', {
        appointments_data: appointmentsData,
        medical_order_id_param: values.medical_order_id, // OBLIGATORIO
        assigned_by_param: profile?.id,
        organization_id_param: currentOrgId // FALLBACK para organización
      });

      if (error) {
        console.error('AUDIT_LOG: Error en create_appointments_with_order para múltiples sesiones:', error);
        
        // Provide specific error messages based on error type
        if (error.message?.includes('User organization not found')) {
          toast({
            title: "Error de autenticación",
            description: "No se pudo verificar su organización. Intente cerrar sesión y volver a entrar.",
            variant: "destructive",
          });
        } else if (error.message?.includes('ORDEN_REQUERIDA')) {
          toast({
            title: "Error de orden médica",
            description: "Orden médica requerida para crear los turnos.",
            variant: "destructive",
          });
        } else if (error.message?.includes('VALIDACION_FALLIDA')) {
          toast({
            title: "Error de validación",
            description: error.message.replace('VALIDACION_FALLIDA: ', ''),
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error creando turnos",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      console.log('AUDIT_LOG: Resultado de creación múltiple:', results);

      const createdCount = results?.filter(r => r.was_created).length || 0;
      const failedCount = results?.filter(r => !r.was_created).length || 0;

      if (createdCount === 0) {
        throw new Error('No se pudo crear ninguna sesión');
      }

      let message = `Se crearon ${createdCount} sesiones múltiples y se vincularon a la orden médica correctamente`;
      if (failedCount > 0) {
        message += `. ${failedCount} sesiones no se pudieron crear por conflictos`;
      }

      toast({
        title: "Éxito",
        description: message,
      });

      // Reset form and sessions
      form.reset();
      setScheduledSessions([]);
      setSelectedDate(undefined);
      setSelectedTime('');
      setAvailableSlots([]);

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('AUDIT_LOG: Error creando sesiones múltiples:', error);
      toast({
        title: "Error",
        description: (error as any).message || 'Error al crear las sesiones múltiples',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Programar Múltiples Sesiones</CardTitle>
          <CardDescription>
            Programa múltiples sesiones para un paciente con orden médica.
            <span className="text-destructive font-medium"> * Todos los turnos requieren una orden médica asociada</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Patient Field */}
                <FormField
                  control={form.control}
                  name="patient_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paciente *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar paciente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {patients.map((patient) => (
                            <SelectItem key={patient.id} value={patient.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {patient.profile.first_name} {patient.profile.last_name}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {patient.profile.dni ? `DNI: ${patient.profile.dni}` : 'Sin DNI'} • {patient.profile.email}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Medical Order Field - OBLIGATORIO */}
                <FormField
                  control={form.control}
                  name="medical_order_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-destructive">
                        Orden Médica *
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          (Obligatorio - Verifique que tenga suficientes sesiones)
                        </span>
                      </FormLabel>
                      
                      {validationStatus.isValidating && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                          Validando órdenes disponibles...
                        </div>
                      )}
                      
                      {validationStatus.error && (
                        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                          {validationStatus.error}
                        </div>
                      )}
                      
                      {validationStatus.warning && (
                        <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                          {validationStatus.warning}
                        </div>
                      )}

                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                        disabled={validationStatus.isValidating || medicalOrders.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger className={medicalOrders.length === 0 ? "opacity-50" : ""}>
                            <SelectValue placeholder={
                              medicalOrders.length === 0 
                                ? "No hay órdenes médicas con suficientes sesiones" 
                                : "Seleccionar orden médica obligatoriamente"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {medicalOrders.map((order) => (
                            <SelectItem key={order.id} value={order.id}>
                              <div className="flex flex-col py-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{order.description}</span>
                                  {order.urgent && (
                                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                                      URGENTE
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  Sesiones disponibles: {order.sessions_remaining}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Doctor: {order.doctor.profile.first_name} {order.doctor.profile.last_name}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Sessions Count */}
              <FormField
                control={form.control}
                name="sessions_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de sesiones a programar *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Doctor Field */}
              <FormField
                control={form.control}
                name="doctor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doctor *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar doctor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {doctors.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: doctor.specialty.color }}
                              />
                              <span>
                                Dr. {doctor.profile.first_name} {doctor.profile.last_name}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({doctor.specialty.name})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reason Field */}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo de la consulta *</FormLabel>
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

              {/* Session Scheduler */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-medium">Programar Sesiones Individuales</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date Picker */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha de la sesión</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Seleccionar fecha"}
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
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Time Picker */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hora de la sesión</label>
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
                    {selectedDate && form.watch('doctor_id') && availableSlots.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No hay horarios disponibles para esta fecha
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={addSession}
                  disabled={!selectedDate || !selectedTime || !form.watch('doctor_id')}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Sesión
                </Button>
              </div>

              {/* Scheduled Sessions */}
              {scheduledSessions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium">
                    Sesiones Programadas ({scheduledSessions.length}/{form.watch('sessions_count')})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {scheduledSessions.map((session, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center space-x-4">
                          <Badge variant="outline">Sesión {session.sessionNumber}</Badge>
                          <span className="font-medium">
                            {format(session.date, 'dd/MM/yyyy')}
                          </span>
                          <span>{session.time.substring(0, 5)}</span>
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

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => {
                  form.reset();
                  setScheduledSessions([]);
                  setSelectedDate(undefined);
                  setSelectedTime('');
                }}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading || isSubmitting || scheduledSessions.length === 0}
                >
                  {isSubmitting ? 'Creando...' : `Crear ${scheduledSessions.length} Sesiones`}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Pending Document Alert */}
      {form.watch('medical_order_id') && medicalOrders.length > 0 && (
        <PendingDocumentAlert 
          medicalOrderId={form.watch('medical_order_id')}
        />
      )}
    </div>
  );
}