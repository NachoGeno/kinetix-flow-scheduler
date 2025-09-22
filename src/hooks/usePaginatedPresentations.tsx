import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "./useDebounce";

interface PresentationFilters {
  searchTerm: string;
  obraSocialId?: string;
  professionalId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

export interface PresentationOrder {
  id: string;
  patient_id: string;
  doctor_id?: string;
  description: string;
  order_type: string;
  total_sessions: number;
  sessions_used: number;
  completed: boolean;
  urgent: boolean;
  order_date: string;
  obra_social_art_id?: string;
  organization_id: string;
  document_status: string;
  presentation_status?: string;
  created_at: string;
  updated_at: string;
  patient_name: string;
  patient_dni?: string;
  patient_email?: string;
  patient_phone?: string;
  professional_name: string;
  obra_social_name?: string;
  obra_social_type?: string;
  document_count: number;
  has_documents: boolean;
  sessions_completed: boolean;
  completed_appointments_count: number;
}

export function usePaginatedPresentations(filters: PresentationFilters) {
  // Debounce search term to avoid excessive queries
  const debouncedSearchTerm = useDebounce(filters.searchTerm, 400);

  return useQuery({
    queryKey: [
      'presentations', 
      'paginated', 
      {
        ...filters,
        searchTerm: debouncedSearchTerm, // Use debounced value
      }
    ],
    queryFn: async () => {
      console.log('Fetching presentations with filters:', {
        ...filters,
        searchTerm: debouncedSearchTerm,
      });

      const { data, error } = await supabase.rpc('search_presentations_paginated', {
        search_term: debouncedSearchTerm?.trim() || null,
        obra_social_filter: filters.obraSocialId || null,
        professional_filter: filters.professionalId || null,
        status_filter: filters.status && filters.status !== 'all' ? filters.status : null,
        date_from: filters.dateFrom || null,
        date_to: filters.dateTo || null,
        page_number: filters.page,
        page_size: filters.limit
      });

      if (error) {
        console.error('Database function error:', error);
        throw error;
      }

      // Transform the JSONB data back to the expected format
      const presentations = (data?.map((row: any) => row.presentation_data) || []) as PresentationOrder[];
      const totalCount = data?.[0]?.total_count || 0;

      console.log('Presentations fetched:', presentations.length);
      console.log('Total count:', totalCount);

      return {
        presentations,
        totalCount,
        totalPages: Math.ceil(totalCount / filters.limit)
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: true, // Always enabled, debounce handles the delay
  });
}