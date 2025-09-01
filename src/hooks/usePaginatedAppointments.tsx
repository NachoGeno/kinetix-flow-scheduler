
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface AppointmentFilters {
  searchTerm: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

export function usePaginatedAppointments(filters: AppointmentFilters) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['appointments', 'paginated', filters],
    queryFn: async () => {
      if (!profile) throw new Error('No authenticated user');

      const from = (filters.page - 1) * filters.limit;
      const to = from + filters.limit - 1;

      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients!inner(
            id,
            profile:profiles(
              first_name,
              last_name,
              dni
            )
          ),
          doctor:doctors!inner(
            id,
            profile:profiles(
              first_name,
              last_name
            ),
            specialty:specialties(
              name,
              color
            )
          )
        `, { count: 'exact' })
        .range(from, to)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });

      // Apply role-based filters
      if (profile.role === 'patient') {
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('profile_id', profile.id)
          .single();
        
        if (patientData) {
          query = query.eq('patient_id', patientData.id);
        }
      } else if (profile.role === 'doctor') {
        const { data: doctorData } = await supabase
          .from('doctors')
          .select('id')
          .eq('profile_id', profile.id)
          .single();
        
        if (doctorData) {
          query = query.eq('doctor_id', doctorData.id);
        }
      }

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status as any);
      }

      if (filters.dateFrom) {
        query = query.gte('appointment_date', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('appointment_date', filters.dateTo);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Apply text search on frontend since we need to search across related tables
      let filteredData = data || [];
      
      if (filters.searchTerm && filters.searchTerm.trim()) {
        const searchLower = filters.searchTerm.toLowerCase().trim();
        
        filteredData = filteredData.filter(appointment => {
          const patientFirstName = appointment.patient?.profile?.first_name?.toLowerCase() || '';
          const patientLastName = appointment.patient?.profile?.last_name?.toLowerCase() || '';
          const patientFullName = `${patientFirstName} ${patientLastName}`.trim();
          const patientDni = appointment.patient?.profile?.dni?.toLowerCase() || '';
          
          const doctorFirstName = appointment.doctor?.profile?.first_name?.toLowerCase() || '';
          const doctorLastName = appointment.doctor?.profile?.last_name?.toLowerCase() || '';
          const doctorFullName = `${doctorFirstName} ${doctorLastName}`.trim();
          const doctorSpecialty = appointment.doctor?.specialty?.name?.toLowerCase() || '';
          
          const reason = appointment.reason?.toLowerCase() || '';
          const notes = appointment.notes?.toLowerCase() || '';

          return patientFullName.includes(searchLower) ||
                 patientFirstName.includes(searchLower) ||
                 patientLastName.includes(searchLower) ||
                 patientDni.includes(searchLower) ||
                 doctorFullName.includes(searchLower) ||
                 doctorFirstName.includes(searchLower) ||
                 doctorLastName.includes(searchLower) ||
                 doctorSpecialty.includes(searchLower) ||
                 reason.includes(searchLower) ||
                 notes.includes(searchLower);
        });
      }

      console.log('Search term:', filters.searchTerm);
      console.log('Total appointments before filter:', data?.length || 0);
      console.log('Appointments after search filter:', filteredData.length);

      return {
        appointments: filteredData,
        totalCount: filteredData.length,
        totalPages: Math.ceil(filteredData.length / filters.limit)
      };
    },
    enabled: !!profile,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
