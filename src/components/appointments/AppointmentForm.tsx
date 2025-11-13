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
import { cn, formatDateToISO, validateAppointmentDate, validateDateIntegrity, logAppointmentDebug, parseDateOnly } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useHolidays } from '@/hooks/useHolidays';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { usePaginatedPatients } from '@/hooks/usePaginatedPatients';
import PatientForm from '@/components/patients/PatientForm';
import MedicalOrderForm from './MedicalOrderForm';
import PendingDocumentAlert from './PendingDocumentAlert';

const formSchema = z.object({
  patient_id: z.string().min(1, 'Selecciona un paciente'),
  medical_order_id: z.string().min(1, 'Debe seleccionar una orden médica - Es obligatorio'), // OBLIGATORIO
  doctor_id: z.string().min(1, 'Selecciona un doctor'),
  appointment_date: z.date({
    message: 'Selecciona una fecha',
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
  sessions_remaining: number;
  active_assignments_count: number;
  document_status: 'pendiente' | 'completa';
  urgent: boolean;
  created_at: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    isValidating: boolean;
    error?: string;
    warning?: string;
  }>({ isValidating: false });
  
  const { profile } = useAuth();
  const { currentOrgId } = useOrganizationContext();
const { toast } = useToast();

  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const debouncedPatientSearch = useDebounce(patientSearchTerm, 300);
  const { data: patientsData, isLoading: isLoadingPatients } = usePaginatedPatients({
    searchTerm: debouncedPatientSearch,
    page: 1,
    limit: 100,
  });
  const patientsList = patientsData?.patients ?? patients;
  
  // Obtener feriados para validación
  const { data: holidays = [] } = useHolidays();

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
      medical_order_id: '', // ELIMINADO 'none' - debe ser obligatorio
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
    // fetchPatients(); // replaced by usePaginatedPatients hook
  }, []);

  useEffect(() => {
    if (form.watch('doctor_id') && form.watch('appointment_date') && doctors.length > 0) {
      fetchAvailableSlots();
    }
  }, [form.watch('doctor_id'), form.watch('appointment_date'), doctors]);

  useEffect(() => {
    if (form.watch('patient_id')) {
      fetchMedicalOrders(form.watch('patient_id'));
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
      // Intentar usar RPC primero (más robusto con RLS)
      const { data, error } = await supabase.rpc('search_patients_paginated', {
        search_term: null,
        page_number: 1,
        page_size: 500
      });

      if (error) {
        console.error('Error fetching patients via RPC:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        // Fallback a SELECT directo si RPC falla
        console.warn('Falling back to direct SELECT for patients in AppointmentForm');

        const { data: directData, error: directError } = await supabase
          .from('patients')
          .select('id, profile:profiles!patients_profile_id_fkey(first_name, last_name, dni, email)')
          .eq('is_active', true);

        if (directError) {
          console.error('Fallback direct SELECT failed:', {
            message: directError.message,
            details: directError.details,
            hint: directError.hint,
            code: directError.code
          });
          toast({
            title: "Error",
            description: `No se pudieron cargar los pacientes: ${directError.message}`,
            variant: "destructive",
          });
          throw directError;
        }

        // Mapear y ordenar en memoria
        const mapped = (directData || []).map((row: any) => ({
          id: row.id,
          profile: {
            first_name: row.profile?.first_name ?? 'N/A',
            last_name: row.profile?.last_name ?? 'N/A',
            dni: row.profile?.dni ?? null,
            email: row.profile?.email ?? 'N/A'
          }
        }));

        mapped.sort((a, b) => {
          const cmpLast = (a.profile.last_name || '').localeCompare(b.profile.last_name || '', 'es', { sensitivity: 'base' });
          return cmpLast !== 0 ? cmpLast : (a.profile.first_name || '').localeCompare(b.profile.first_name || '', 'es', { sensitivity: 'base' });
        });

        setPatients(mapped);
        return;
      }

      // Mapear respuesta del RPC y ordenar en memoria
      const mappedPatients = (data || []).map((row: any) => ({
        id: row.patient_data.id,
        profile: {
          first_name: row.patient_data.profile?.first_name ?? 'N/A',
          last_name: row.patient_data.profile?.last_name ?? 'N/A',
          dni: row.patient_data.profile?.dni ?? null,
          email: row.patient_data.profile?.email ?? 'N/A'
        }
      }));

      mappedPatients.sort((a, b) => {
        const cmpLast = (a.profile.last_name || '').localeCompare(b.profile.last_name || '', 'es', { sensitivity: 'base' });
        return cmpLast !== 0 ? cmpLast : (a.profile.first_name || '').localeCompare(b.profile.first_name || '', 'es', { sensitivity: 'base' });
      });

      setPatients(mappedPatients);

    } catch (error: any) {
      console.error('Exception fetching patients:', error);
      toast({
        title: "Error",
        description: `No se pudieron cargar los pacientes: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const fetchMedicalOrders = async (patientId: string) => {
    try {
      setValidationStatus({ isValidating: true });
      
      const { data, error } = await supabase.rpc('get_medical_orders_with_availability', {
        patient_id_param: patientId
      });

      if (error) {
        console.error('Error fetching medical orders:', error);
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

      console.log(`AUDIT_LOG: Medical orders for patient ${patientId}:`, data);
      
      // Transform data to match expected interface
      const transformedOrders = (data || []).map(order => ({
        id: order.id,
        description: order.description,
        instructions: order.instructions || null,
        doctor_name: null,
        total_sessions: order.total_sessions,
        sessions_used: order.sessions_used,
        sessions_remaining: order.sessions_remaining,
        active_assignments_count: order.active_assignments_count,
        urgent: order.urgent || false,
        document_status: (order.document_status as 'pendiente' | 'completa') || 'pendiente',
        created_at: order.created_at,
      }));

      setMedicalOrders(transformedOrders);
      
      // Auto-asignación inteligente
      if (transformedOrders && transformedOrders.length === 1) {
        // Solo UNA orden disponible -> Auto-asignar
        const singleOrder = transformedOrders[0];
        form.setValue('medical_order_id', singleOrder.id);
        console.log(`AUDIT_LOG: Auto-asignando orden única ${singleOrder.id} para paciente ${patientId}`);
        setValidationStatus({ 
          isValidating: false,
          warning: `Auto-asignado a orden: ${singleOrder.description} (${singleOrder.sessions_remaining} sesiones restantes)`
        });
      } else if (transformedOrders && transformedOrders.length === 0) {
        // Sin órdenes disponibles
        setValidationStatus({ 
          isValidating: false,
          error: 'Este paciente no tiene órdenes médicas con sesiones disponibles. Debe crear una nueva orden médica primero.'
        });
        form.setValue('medical_order_id', '');
      } else if (transformedOrders && transformedOrders.length > 1) {
        // Múltiples órdenes -> Forzar selección manual
        setValidationStatus({ 
          isValidating: false,
          warning: `Seleccione una de las ${transformedOrders.length} órdenes médicas disponibles`
        });
        form.setValue('medical_order_id', '');
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
    const appointmentDate = form.watch('appointment_date');

    console.log('fetchAvailableSlots llamado:', { doctorId, appointmentDate });

    if (!doctorId || !appointmentDate) {
      console.log('No hay doctor o fecha seleccionada');
      return;
    }

    // Verificar si la fecha es feriado
    const selectedDateStr = formatDateToISO(appointmentDate);
    const holidayOnDate = holidays.find(h => h.date === selectedDateStr);
    
    if (holidayOnDate) {
      setAvailableSlots([]);
      toast({
        title: "Fecha no disponible",
        description: `${holidayOnDate.name} - No se pueden agendar turnos en feriados`,
        variant: "destructive",
      });
      return;
    }

    try {
      const doctor = doctors.find(d => d.id === doctorId);
      if (!doctor) {
        console.log('Doctor no encontrado');
        return;
      }

      console.log('Doctor encontrado:', doctor);

      // Get existing appointments for this doctor and date, INCLUDING STATUS
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('appointment_time, status')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', formatDateToISO(appointmentDate));

      if (error) throw error;

      console.log('Citas existentes (con status):', appointments);

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

      // Contar SOLO citas activas (excluyendo estados finalizados)
      const activeAppointmentCounts = {};
      (appointments || []).forEach(apt => {
        if (!['cancelled', 'discharged', 'completed', 'no_show'].includes(apt.status)) {  // Solo contar las que están activas
          activeAppointmentCounts[apt.appointment_time] = (activeAppointmentCounts[apt.appointment_time] || 0) + 1;
        }
      });

      console.log('Conteo de citas ACTIVAS por slot (sin canceladas):', activeAppointmentCounts);

      // Mostrar solo slots con menos de 3 pacientes ACTIVOS programados
      const availableSlots = slots.filter(slot => {
        const currentCount = activeAppointmentCounts[slot] || 0;
        return currentCount < 3;
      });

      console.log('Slots disponibles (máximo 3 por bloque, excluyendo canceladas):', availableSlots);

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
    setPatientSearchTerm('');
    setIsNewPatientDialogOpen(false);
  };

  const handleNewOrderCreated = (order: any) => {
    // Actualizar el formulario con la nueva orden
    form.setValue('medical_order_id', order.id);
    form.setValue('reason', order.description);
    
    fetchMedicalOrders(form.watch('patient_id'));
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
        // Verificar si la fecha es feriado (saltar sin contar como sesión)
        const dateStr = formatDateToISO(currentDate);
        const isHoliday = holidays.some(h => h.date === dateStr);
        
        if (isHoliday) {
          // Saltar este día sin incrementar sessionNumber
          currentDate = addDays(currentDate, 1);
          attempts++;
          continue;
        }

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
      // Verificar si la fecha es feriado
      const dateStr = formatDateToISO(date);
      const holidayOnDate = holidays.find(h => h.date === dateStr);
      
      if (holidayOnDate) {
        return { 
          hasConflict: true, 
          reason: `Feriado: ${holidayOnDate.name}` 
        };
      }

      const { data: existingAppointments, error } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', formatDateToISO(date))
        .not('status', 'in', '(cancelled,discharged,completed,no_show)');

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

    // VALIDACIÓN CRÍTICA: Orden médica es OBLIGATORIA
    if (!values.medical_order_id) {
      toast({
        title: "Error",
        description: "Debe seleccionar una orden médica. Todos los turnos requieren una orden médica asociada.",
        variant: "destructive",
      });
      return;
    }

      // Get patient, doctor and order info for the summary
      const patient = patients.find(p => p.id === values.patient_id);
      const doctor = doctors.find(d => d.id === values.doctor_id);
      const medicalOrder = medicalOrders.find(o => o.id === values.medical_order_id);

      if (!patient || !doctor) {
        toast({
          title: "Error",
          description: "Error al obtener información del paciente o doctor",
          variant: "destructive",
        });
        return;
      }

      // === VALIDACIONES PREVENTIVAS ===
      
      // 1. Validar rango de fecha
      const dateValidation = validateAppointmentDate(values.appointment_date);
      if (!dateValidation.isValid) {
        toast({
          title: "Error",
          description: dateValidation.error || "Fecha inválida",
          variant: "destructive",
        });
        return;
      }

      // 2. Validar que no sea feriado
      const selectedDate = formatDateToISO(values.appointment_date);
      const holidayOnDate = holidays.find(h => h.date === selectedDate);
      
      if (holidayOnDate) {
        toast({
          title: "Fecha no disponible",
          description: `${holidayOnDate.name} - No se pueden agendar turnos en feriados`,
          variant: "destructive",
        });
        return;
      }

      // 3. Validar integridad de fecha
      const integrityCheck = validateDateIntegrity(values.appointment_date, selectedDate);
      
      // 4. Logging para debugging
      logAppointmentDebug('Turno individual validado', {
        selectedDate: values.appointment_date,
        formattedDate: selectedDate,
        appointmentTime: values.appointment_time,
        doctorId: values.doctor_id,
        patientId: values.patient_id,
      });

      // 5. Alertar discrepancias
      if (!integrityCheck.isValid && integrityCheck.warning) {
        console.warn(`⚠️ ${integrityCheck.warning}`);
      }

      // Check for duplicates
      const { data: existingAppointment, error } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', values.patient_id)
        .eq('doctor_id', values.doctor_id)
        .eq('appointment_date', selectedDate) // Usar fecha ya validada
        .eq('appointment_time', values.appointment_time)
        .in('status', ['scheduled', 'confirmed', 'in_progress'])
        .maybeSingle();

      if (error) throw error;

      if (existingAppointment) {
        toast({
          title: "Error",
          description: "Ya existe una cita programada para este paciente en esta fecha y hora",
          variant: "destructive",
        });
        return;
      }

      const summary = {
        patient: `${patient.profile.first_name} ${patient.profile.last_name}`,
        doctor: `Dr. ${doctor.profile.first_name} ${doctor.profile.last_name}`,
        specialty: doctor.specialty.name,
        date: format(values.appointment_date, 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: es }),
        time: values.appointment_time.substring(0, 5),
        reason: values.reason,
        medicalOrder: medicalOrder ? `${medicalOrder.description} (${medicalOrder.sessions_remaining} sesiones restantes)` : 'Sin orden médica',
        isRecurring: values.is_recurring,
        sessionsCount: values.sessions_count,
        recurringAppointments: values.is_recurring ? recurringAppointments : [],
        rawData: values
      };

      setAppointmentSummary(summary);
      setIsConfirmDialogOpen(true);
      } catch (error) {
        console.error('Error preparing summary:', error);
        toast({
          title: "Error",
          description: (error as Error)?.message || "Error al preparar el resumen",
          variant: "destructive",
        });
      } finally {
      setLoading(false);
    }
  };

  const confirmAppointment = async () => {
    if (!appointmentSummary || isSubmitting) return;

    try {
      setIsSubmitting(true);

      if (appointmentSummary.isRecurring) {
        // Handle recurring appointments
        await createRecurringAppointments();
      } else {
        // Handle single appointment with STRICT validation
        await createSingleAppointment();
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast({
        title: "Error",
        description: (error as Error)?.message || "Error al crear la cita",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const createSingleAppointment = async () => {
    const values = appointmentSummary.rawData;

    // VALIDACIÓN FINAL: Orden médica es OBLIGATORIA
    if (!values.medical_order_id) {
      throw new Error('ORDEN_REQUERIDA: La orden médica es obligatoria');
    }

    console.log(`AUDIT_LOG: Creando turno individual con orden ${values.medical_order_id}`);

    // === VALIDACIONES PREVENTIVAS FINALES ===
    const formattedDate = formatDateToISO(values.appointment_date);
    const dateValidation = validateAppointmentDate(values.appointment_date);
    const integrityCheck = validateDateIntegrity(values.appointment_date, formattedDate);

      logAppointmentDebug('Creando turno individual - validaciones finales', {
        selectedDate: values.appointment_date,
        formattedDate: formattedDate,
        appointmentTime: values.appointment_time,
        doctorId: values.doctor_id,
        patientId: values.patient_id,
      });

    if (!dateValidation.isValid) {
      throw new Error(`Fecha inválida: ${dateValidation.error}`);
    }

    const appointmentData = {
      patient_id: values.patient_id,
      doctor_id: values.doctor_id,
      appointment_date: formattedDate, // Usar fecha ya validada
      appointment_time: values.appointment_time,
      reason: values.reason,
      status: 'scheduled',
      notes: values.medical_order_id ? `Vinculado a orden médica: ${values.medical_order_id}` : null,
    };

    // Create appointment using the strict RPC function
    const { data: results, error } = await supabase.rpc('create_appointments_with_order', {
      appointments_data: [appointmentData],
      medical_order_id_param: values.medical_order_id, // OBLIGATORIO
      assigned_by_param: profile?.id,
      organization_id_param: currentOrgId // FALLBACK para organización
    });

      if (error) {
        console.error('AUDIT_LOG: Error en create_appointments_with_order:', error);
        
        // Provide specific error messages based on error type
        if (error.message?.includes('User organization not found')) {
          throw new Error('Error de autenticación: No se pudo verificar su organización. Intente cerrar sesión y volver a entrar.');
        } else if (error.message?.includes('ORDEN_REQUERIDA')) {
          throw new Error('Error: Orden médica requerida para crear el turno.');
        } else if (error.message?.includes('VALIDACION_FALLIDA')) {
          throw new Error(error.message.replace('VALIDACION_FALLIDA: ', ''));
        } else {
          throw error;
        }
      }

    console.log('AUDIT_LOG: Resultado de creación:', results);

    if (!results || results.length === 0) {
      throw new Error('No se pudo crear la cita');
    }

    const result = results[0];
    if (!result.was_created) {
      throw new Error(result.conflict_reason || 'Error desconocido al crear la cita');
    }

    toast({
      title: "Éxito",
      description: "Cita creada y vinculada a la orden médica correctamente",
    });

    form.reset();
    setIsConfirmDialogOpen(false);
    if (onSuccess) onSuccess();
  };

  const createRecurringAppointments = async () => {
    const values = appointmentSummary.rawData;

    // VALIDACIÓN FINAL: Orden médica es OBLIGATORIA
    if (!values.medical_order_id) {
      throw new Error('ORDEN_REQUERIDA: La orden médica es obligatoria para citas recurrentes');
    }

    console.log(`AUDIT_LOG: Creando ${recurringAppointments.length} turnos recurrentes con orden ${values.medical_order_id}`);

    // Validate all dates before creating appointments
    const appointmentsData = recurringAppointments.map((apt, index) => {
      const formattedDate = formatDateToISO(apt.date);
      const dateValidation = validateAppointmentDate(apt.date);
      const integrityCheck = validateDateIntegrity(apt.date, formattedDate);

        logAppointmentDebug(`Turno recurrente ${index + 1}/${recurringAppointments.length}`, {
          selectedDate: apt.date,
          formattedDate: formattedDate,
          appointmentTime: apt.time,
          doctorId: values.doctor_id,
          patientId: values.patient_id,
        });

      if (!dateValidation.isValid) {
        throw new Error(`Fecha inválida en sesión ${apt.sessionNumber}: ${dateValidation.error}`);
      }

      return {
        patient_id: values.patient_id,
        doctor_id: values.doctor_id,
        appointment_date: formattedDate, // Usar fecha ya validada
        appointment_time: apt.time,
        reason: values.reason,
        status: 'scheduled',
        notes: `Sesión ${apt.sessionNumber} de ${recurringAppointments.length} - Orden: ${values.medical_order_id}`,
      };
    });

    // Create all appointments using the strict RPC function
    const { data: results, error } = await supabase.rpc('create_appointments_with_order', {
      appointments_data: appointmentsData,
      medical_order_id_param: values.medical_order_id, // OBLIGATORIO
      assigned_by_param: profile?.id,
      organization_id_param: currentOrgId // FALLBACK para organización
    });

      if (error) {
        console.error('AUDIT_LOG: Error en create_appointments_with_order para recurrentes:', error);
        
        // Provide specific error messages based on error type
        if (error.message?.includes('User organization not found')) {
          throw new Error('Error de autenticación: No se pudo verificar su organización. Intente cerrar sesión y volver a entrar.');
        } else if (error.message?.includes('ORDEN_REQUERIDA')) {
          throw new Error('Error: Orden médica requerida para crear los turnos.');
        } else if (error.message?.includes('VALIDACION_FALLIDA')) {
          throw new Error(error.message.replace('VALIDACION_FALLIDA: ', ''));
        } else {
          throw error;
        }
      }

    console.log('AUDIT_LOG: Resultado de creación recurrente:', results);

    const createdCount = results?.filter(r => r.was_created).length || 0;
    const failedCount = results?.filter(r => !r.was_created).length || 0;

    if (createdCount === 0) {
      throw new Error('No se pudo crear ninguna cita recurrente');
    }

    let message = `Se crearon ${createdCount} citas recurrentes y se vincularon a la orden médica correctamente`;
    if (failedCount > 0) {
      message += `. ${failedCount} citas no se pudieron crear por conflictos`;
    }

    toast({
      title: "Éxito",
      description: message,
    });

    form.reset();
    setRecurringAppointments([]);
    setIsConfirmDialogOpen(false);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Agendar Nueva Cita</CardTitle>
          <CardDescription>
            Complete los datos para agendar una nueva cita médica. 
            <span className="text-destructive font-medium"> * Todos los turnos requieren una orden médica asociada</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleShowSummary)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Patient Field */}
                <FormField
                  control={form.control}
                  name="patient_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Paciente *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? (() => {
                                    const patient = patientsList.find(p => p.id === field.value);
                                    return patient ? `${patient.profile.first_name} ${patient.profile.last_name}` : "Seleccionar paciente";
                                  })()
                                : "Seleccionar paciente"}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="p-0" side="bottom" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar paciente..." value={patientSearchTerm} onValueChange={setPatientSearchTerm} />
                            <CommandList>
                              <CommandEmpty>
                                <div className="text-center py-2">
                                  <p>No se encontraron pacientes</p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => setIsNewPatientDialogOpen(true)}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Crear nuevo paciente
                                  </Button>
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {patientsList.map((patient) => (
                                  <CommandItem
                                    key={patient.id}
                                    value={`${patient.profile.first_name} ${patient.profile.last_name} ${patient.profile.dni || ''}`}
                                    onSelect={() => {
                                      form.setValue("patient_id", patient.id);
                                      form.clearErrors("patient_id");
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {patient.profile.first_name} {patient.profile.last_name}
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        {patient.profile.dni ? `DNI: ${patient.profile.dni}` : 'Sin DNI'} • {patient.profile.email}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                          (Obligatorio - Todos los turnos requieren una orden médica)
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
                                ? "No hay órdenes médicas disponibles" 
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
                                  Sesiones disponibles: {order.sessions_remaining} de {order.total_sessions}
                                  {order.active_assignments_count > 0 && 
                                    ` • ${order.active_assignments_count} asignadas`}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Creada: {new Date(order.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      
                      {form.watch('patient_id') && medicalOrders.length === 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setIsNewOrderDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Crear nueva orden médica
                        </Button>
                      )}
                    </FormItem>
                  )}
                />
              </div>

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

              {/* Date and Time Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="appointment_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de la cita *</FormLabel>
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
                                <span>Selecciona una fecha</span>
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
                            disabled={(date) => {
                              // Deshabilitar fechas pasadas
                              if (date < new Date() || date < new Date("1900-01-01")) return true;
                              
                              // Deshabilitar feriados
                              const dateStr = formatDateToISO(date);
                              return holidays.some(h => h.date === dateStr);
                            }}
                            initialFocus
                            locale={es}
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
                      <FormLabel>Hora de la cita *</FormLabel>
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
                      {form.watch('doctor_id') && form.watch('appointment_date') && availableSlots.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No hay horarios disponibles para esta fecha
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              </div>

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

              {/* Recurring Appointment Toggle */}
              <FormField
                control={form.control}
                name="is_recurring"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Citas recurrentes
                      </FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Programa múltiples citas en días específicos de la semana
                      </div>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Recurring Options */}
              {isRecurring && (
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="font-medium">Configuración de citas recurrentes</h3>
                  
                  <FormField
                    control={form.control}
                    name="sessions_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de sesiones</FormLabel>
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
                            <div>
                              <span className="font-medium">Sesión {apt.sessionNumber}</span>
                              <span className="text-muted-foreground ml-2">
                                {format(apt.date, 'dd/MM/yyyy')} - {apt.time.substring(0, 5)}
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

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => form.reset()}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading || isSubmitting}>
                  {loading ? 'Validando...' : 'Confirmar Cita'}
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

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar {appointmentSummary?.isRecurring ? 'Citas Recurrentes' : 'Cita'}</DialogTitle>
            <DialogDescription>
              Por favor revise los detalles antes de confirmar
            </DialogDescription>
          </DialogHeader>
          
          {appointmentSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Paciente:</strong> {appointmentSummary.patient}
                </div>
                <div>
                  <strong>Doctor:</strong> {appointmentSummary.doctor}
                </div>
                <div>
                  <strong>Especialidad:</strong> {appointmentSummary.specialty}
                </div>
                <div>
                  <strong>Orden Médica:</strong> {appointmentSummary.medicalOrder}
                </div>
                {!appointmentSummary.isRecurring && (
                  <>
                    <div>
                      <strong>Fecha:</strong> {appointmentSummary.date}
                    </div>
                    <div>
                      <strong>Hora:</strong> {appointmentSummary.time}
                    </div>
                  </>
                )}
              </div>
              
              <div>
                <strong>Motivo:</strong> {appointmentSummary.reason}
              </div>

              {appointmentSummary.isRecurring && (
                <div className="space-y-2">
                  <strong>Citas programadas ({appointmentSummary.recurringAppointments.length}):</strong>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {appointmentSummary.recurringAppointments.map((apt, index) => (
                      <div key={index} className="text-sm p-2 bg-muted rounded">
                        Sesión {apt.sessionNumber}: {format(apt.date, 'dd/MM/yyyy')} - {apt.time.substring(0, 5)}
                        {apt.conflict && (
                          <span className="text-destructive ml-2">({apt.conflictReason})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmAppointment} disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Patient Dialog */}
      <Dialog open={isNewPatientDialogOpen} onOpenChange={setIsNewPatientDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Paciente</DialogTitle>
          </DialogHeader>
          <PatientForm 
            onSuccess={handleNewPatientCreated}
            onCancel={() => setIsNewPatientDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* New Medical Order Dialog */}
      <Dialog open={isNewOrderDialogOpen} onOpenChange={setIsNewOrderDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nueva Orden Médica</DialogTitle>
          </DialogHeader>
          <MedicalOrderForm 
            selectedPatient={form.watch('patient_id')}
            onSuccess={handleNewOrderCreated}
            onCancel={() => setIsNewOrderDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
