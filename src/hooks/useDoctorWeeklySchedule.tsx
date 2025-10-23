import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfWeek, endOfWeek, format, parse, addMinutes } from "date-fns";
import { es } from "date-fns/locale";

interface DoctorScheduleSlot {
  time: string; // "08:00"
  status: 'free' | 'occupied' | 'non-working';
  appointments?: Array<{
    id: string;
    patient_id: string;
    appointment_date: string;
    patientName: string;
    obraSocial: string;
    status: string;
    reason: string | null;
    duration_minutes: number;
  }>;
}

interface DaySchedule {
  date: Date;
  dayName: string;
  isWorkingDay: boolean;
  slots: DoctorScheduleSlot[];
}

interface DoctorWeeklySchedule {
  doctor: {
    id: string;
    name: string;
    specialty: string;
    specialtyColor: string;
    workStartTime: string;
    workEndTime: string;
    appointmentDuration: number;
    workDays: string[];
  } | null;
  weekSchedule: { [dateKey: string]: DaySchedule };
  timeSlots: string[];
  weekStart: Date;
  weekEnd: Date;
}

const dayNameToIndex: { [key: string]: number } = {
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6,
  'sunday': 0,
};

export function useDoctorWeeklySchedule(doctorId: string | undefined, weekStartDate: Date) {
  const { profile } = useAuth();

  const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1, locale: es });
  const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1, locale: es });

  return useQuery({
    queryKey: ['doctor-weekly-schedule', doctorId, format(weekStart, 'yyyy-MM-dd')],
    queryFn: async (): Promise<DoctorWeeklySchedule> => {
      if (!profile?.organization_id) throw new Error('No organization ID');
      if (!doctorId) throw new Error('No doctor selected');

      // 1. Obtener datos completos del doctor
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select(`
          id,
          profile:profiles(first_name, last_name),
          specialty:specialties(name, color),
          work_start_time,
          work_end_time,
          appointment_duration,
          work_days
        `)
        .eq('id', doctorId)
        .eq('organization_id', profile.organization_id)
        .single();

      if (doctorError) throw doctorError;
      if (!doctorData) throw new Error('Doctor not found');

      const doctor = {
        id: doctorData.id,
        name: doctorData.profile 
          ? `${doctorData.profile.first_name} ${doctorData.profile.last_name}`
          : 'Doctor',
        specialty: doctorData.specialty?.name || 'Sin especialidad',
        specialtyColor: doctorData.specialty?.color || '#3B82F6',
        workStartTime: doctorData.work_start_time || '08:00:00',
        workEndTime: doctorData.work_end_time || '17:00:00',
        appointmentDuration: doctorData.appointment_duration || 30,
        workDays: doctorData.work_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      };

      // 2. Obtener todos los turnos de la semana para ese doctor
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          patient_id,
          appointment_date,
          appointment_time,
          status,
          reason,
          duration_minutes,
          patient:patients(
            id,
            profile:profiles(first_name, last_name),
            obra_social_art:obras_sociales_art(id, nombre)
          )
        `)
        .eq('doctor_id', doctorId)
        .eq('organization_id', profile.organization_id)
        .gte('appointment_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('appointment_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      // 3. Generar intervalos de tiempo
      const startTime = parse(doctor.workStartTime, 'HH:mm:ss', new Date());
      const endTime = parse(doctor.workEndTime, 'HH:mm:ss', new Date());
      const timeSlots: string[] = [];
      let currentTime = startTime;

      while (currentTime < endTime) {
        timeSlots.push(format(currentTime, 'HH:mm'));
        currentTime = addMinutes(currentTime, doctor.appointmentDuration);
      }

      // 4. Generar matriz de la semana
      const weekSchedule: { [dateKey: string]: DaySchedule } = {};
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dateKey = format(date, 'yyyy-MM-dd');
        const dayOfWeek = date.getDay();
        
        // Convertir dayOfWeek a nombre del día
        const dayName = Object.keys(dayNameToIndex).find(
          key => dayNameToIndex[key] === dayOfWeek
        ) || '';

        const isWorkingDay = doctor.workDays.includes(dayName);

        // Obtener turnos del día
        const dayAppointments = (appointments || []).filter(
          (apt: any) => apt.appointment_date === dateKey
        );

        const slots: DoctorScheduleSlot[] = timeSlots.map(timeSlot => {
          if (!isWorkingDay) {
            return {
              time: timeSlot,
              status: 'non-working' as const,
            };
          }

          // Buscar todos los turnos en este horario
          const appointmentsInSlot = dayAppointments.filter((apt: any) => {
            const aptTime = format(parse(apt.appointment_time, 'HH:mm:ss', new Date()), 'HH:mm');
            return aptTime === timeSlot;
          });

          if (appointmentsInSlot.length > 0) {
            return {
              time: timeSlot,
              status: 'occupied' as const,
          appointments: appointmentsInSlot.map((appointment: any) => ({
            id: appointment.id,
            patient_id: appointment.patient_id,
            appointment_date: appointment.appointment_date,
            patientName: appointment.patient?.profile
              ? `${appointment.patient.profile.first_name} ${appointment.patient.profile.last_name}`
              : 'Sin paciente',
            obraSocial: appointment.patient?.obra_social_art?.nombre || 'Particular',
            status: appointment.status,
            reason: appointment.reason,
            duration_minutes: appointment.duration_minutes || doctor.appointmentDuration,
          })),
            };
          }

          return {
            time: timeSlot,
            status: 'free' as const,
          };
        });

        weekSchedule[dateKey] = {
          date,
          dayName: format(date, 'EEEE', { locale: es }),
          isWorkingDay,
          slots,
        };
      }

      return {
        doctor,
        weekSchedule,
        timeSlots,
        weekStart,
        weekEnd,
      };
    },
    enabled: !!profile?.organization_id && !!doctorId,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  });
}
