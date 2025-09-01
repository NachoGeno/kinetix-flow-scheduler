
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

      // Apply text search at database level before pagination
      if (filters.searchTerm && filters.searchTerm.trim()) {
        const searchTerm = filters.searchTerm.trim();
        query = query.or(`
          patient.profile.first_name.ilike.%${searchTerm}%,
          patient.profile.last_name.ilike.%${searchTerm}%,
          patient.profile.dni.ilike.%${searchTerm}%,
          doctor.profile.first_name.ilike.%${searchTerm}%,
          doctor.profile.last_name.ilike.%${searchTerm}%,
          doctor.specialty.name.ilike.%${searchTerm}%,
          reason.ilike.%${searchTerm}%,
          notes.ilike.%${searchTerm}%
        `);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      console.log('Search term:', filters.searchTerm);
      console.log('Database query results:', data?.length || 0);
      console.log('Total count from database:', count || 0);

      return {
        appointments: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / filters.limit)
      };
    },
    enabled: !!profile,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
