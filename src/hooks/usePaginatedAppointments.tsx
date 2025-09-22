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

      const offset = (filters.page - 1) * filters.limit;

      // Use the new database function for efficient searching
      const { data, error } = await supabase.rpc('search_appointments_paginated', {
        search_term: filters.searchTerm?.trim() || null,
        status_filter: filters.status && filters.status !== 'all' ? filters.status : null,
        date_from: filters.dateFrom || null,
        date_to: filters.dateTo || null,
        user_role: profile.role,
        user_profile_id: profile.id,
        limit_count: filters.limit,
        offset_count: offset
      });

      if (error) {
        console.error('Database function error:', error);
        throw error;
      }

      console.log('Search term:', filters.searchTerm);
      console.log('Function results:', data?.length || 0);

      // Transform the JSONB data back to the expected format
      const appointments = data?.map((row: any) => row.appointment_data) || [];
      const totalCount = data?.[0]?.total_count || 0;

      console.log('Appointments count:', appointments.length);
      console.log('Total count:', totalCount);

      return {
        appointments,
        totalCount,
        totalPages: Math.ceil(totalCount / filters.limit)
      };
    },
    enabled: !!profile,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}