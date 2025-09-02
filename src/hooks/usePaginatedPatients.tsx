import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PatientFilters {
  searchTerm: string;
  page: number;
  limit: number;
}

export function usePaginatedPatients(filters: PatientFilters) {
  return useQuery({
    queryKey: ['patients', 'paginated', filters],
    queryFn: async () => {
      const from = (filters.page - 1) * filters.limit;
      const to = from + filters.limit - 1;

      let query = supabase
        .from('patients')
        .select(`
          *,
          profile:profiles(
            first_name,
            last_name,
            dni,
            email,
            phone,
            date_of_birth,
            avatar_url
          )
        `, { count: 'exact' })
        .eq('is_active', true)
        .range(from, to)
        .order('created_at', { ascending: false });

      // Apply search filter on the server side
      if (filters.searchTerm) {
        query = query.or(`profile.first_name.ilike.%${filters.searchTerm}%,profile.last_name.ilike.%${filters.searchTerm}%,profile.email.ilike.%${filters.searchTerm}%,profile.dni.ilike.%${filters.searchTerm}%,medical_record_number.ilike.%${filters.searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        patients: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / filters.limit)
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}