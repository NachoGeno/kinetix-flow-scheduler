import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";

interface WeeklyFilters {
  weekStartDate: Date;
  doctorId?: string;
  obraSocialId?: string;
  statuses?: string[];
}

interface AppointmentData {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  patient: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
    } | null;
    obra_social_art: {
      id: string;
      nombre: string;
    } | null;
  } | null;
  doctor: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
    } | null;
    specialty: {
      name: string;
      color: string;
    } | null;
  } | null;
}

interface DoctorAppointments {
  doctorId: string;
  doctorName: string;
  specialty: string;
  specialtyColor: string;
  appointmentsByDay: {
    [day: string]: AppointmentData[];
  };
}

export function useWeeklyAppointments(filters: WeeklyFilters) {
  const { profile } = useAuth();

  const weekStart = startOfWeek(filters.weekStartDate, { weekStartsOn: 1, locale: es });
  const weekEnd = endOfWeek(filters.weekStartDate, { weekStartsOn: 1, locale: es });

  return useQuery({
    queryKey: ['appointments', 'weekly', {
      start: format(weekStart, 'yyyy-MM-dd'),
      end: format(weekEnd, 'yyyy-MM-dd'),
      ...filters
    }],
    queryFn: async () => {
      if (!profile?.organization_id) throw new Error('No organization ID');

      let query = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          reason,
          patient:patients(
            id,
            profile:profiles(first_name, last_name),
            obra_social_art:obras_sociales_art(id, nombre)
          ),
          doctor:doctors(
            id,
            profile:profiles(first_name, last_name),
            specialty:specialties(name, color)
          )
        `)
        .eq('organization_id', profile.organization_id)
        .gte('appointment_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('appointment_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      // Aplicar filtros opcionales
      if (filters.doctorId) {
        query = query.eq('doctor_id', filters.doctorId);
      }

      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses as any);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching weekly appointments:', error);
        throw error;
      }

      // Filtrar por obra social si es necesario (post-query)
      let filteredData = data || [];
      if (filters.obraSocialId) {
        filteredData = filteredData.filter((apt: any) => 
          apt.patient?.obra_social_art?.id === filters.obraSocialId
        );
      }

      // Agrupar por doctor y luego por día
      const appointmentsByDoctor: { [key: string]: DoctorAppointments } = {};
      
      filteredData.forEach((apt: any) => {
        if (!apt.doctor) return;

        const doctorId = apt.doctor.id;
        const doctorName = apt.doctor.profile 
          ? `${apt.doctor.profile.first_name} ${apt.doctor.profile.last_name}`
          : 'Sin nombre';
        const specialty = apt.doctor.specialty?.name || 'Sin especialidad';
        const specialtyColor = apt.doctor.specialty?.color || '#3B82F6';

        if (!appointmentsByDoctor[doctorId]) {
          appointmentsByDoctor[doctorId] = {
            doctorId,
            doctorName,
            specialty,
            specialtyColor,
            appointmentsByDay: {}
          };
        }

        const dayKey = apt.appointment_date;
        if (!appointmentsByDoctor[doctorId].appointmentsByDay[dayKey]) {
          appointmentsByDoctor[doctorId].appointmentsByDay[dayKey] = [];
        }

        appointmentsByDoctor[doctorId].appointmentsByDay[dayKey].push(apt);
      });

      // Calcular estadísticas
      const totalAppointments = filteredData.length;
      const statusCounts = filteredData.reduce((acc: any, apt: any) => {
        acc[apt.status] = (acc[apt.status] || 0) + 1;
        return acc;
      }, {});

      return {
        appointmentsByDoctor,
        totalAppointments,
        statusCounts,
        weekStart,
        weekEnd
      };
    },
    enabled: !!profile?.organization_id,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}
