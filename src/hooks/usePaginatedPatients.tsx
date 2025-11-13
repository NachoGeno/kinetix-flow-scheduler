import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PatientFilters {
  searchTerm: string;
  page: number;
  limit: number;
}

export function usePaginatedPatients(filters: PatientFilters) {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: ['patients', 'paginated', 'organization-aware', filters, user?.id],
    queryFn: async () => {
      // Validar que tenemos autenticación y organización
      if (!user || !profile?.organization_id) {
        throw new Error('Usuario no autenticado o sin organización');
      }

      console.log('🔍 Fetching patients with auth:', { 
        userId: user.id, 
        orgId: profile.organization_id,
        searchTerm: filters.searchTerm 
      });

      // Use the new PostgreSQL search function for better performance
      const { data, error } = await supabase.rpc('search_patients_paginated', {
        search_term: filters.searchTerm || null,
        page_number: filters.page,
        page_size: filters.limit
      });

      if (error) {
        console.error('❌ RPC Error:', error);
        
        // Fallback: Consulta directa si RPC falla
        console.log('🔄 Attempting fallback direct query...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('patients')
          .select(`
            *,
            profile:profiles!patients_profile_id_fkey(
              first_name, last_name, dni, email, phone,
              date_of_birth, avatar_url
            ),
            obra_social_art:obras_sociales_art(nombre)
          `)
          .eq('is_active', true)
          .eq('organization_id', profile.organization_id)
          .ilike('profile.first_name', `%${filters.searchTerm || ''}%`)
          .order('created_at', { ascending: false })
          .limit(filters.limit);

        if (fallbackError) {
          console.error('❌ Fallback Error:', fallbackError);
          throw fallbackError;
        }

        console.log('✅ Fallback successful:', fallbackData?.length, 'patients');
        return {
          patients: fallbackData || [],
          totalCount: fallbackData?.length || 0,
          totalPages: 1
        };
      }

      // Extract patients and count from the function result
      const patients = data?.map((row: any) => row.patient_data) || [];
      const totalCount = data?.[0]?.total_count || 0;
      const totalPages = Math.ceil(totalCount / filters.limit);

      console.log('✅ RPC successful:', patients.length, 'patients of', totalCount, 'total');

      return {
        patients,
        totalCount,
        totalPages
      };
    },
    // Solo ejecutar cuando haya autenticación
    enabled: !!user && !!profile?.organization_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}