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
      // Use the new PostgreSQL search function for better performance
      const { data, error } = await supabase.rpc('search_patients_paginated', {
        search_term: filters.searchTerm || null,
        page_number: filters.page,
        page_size: filters.limit
      });

      if (error) throw error;

      // Extract patients and count from the function result
      const patients = data?.map((row: any) => row.patient_data) || [];
      const totalCount = data?.[0]?.total_count || 0;
      const totalPages = Math.ceil(totalCount / filters.limit);

      return {
        patients,
        totalCount,
        totalPages
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}