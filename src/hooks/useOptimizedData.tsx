import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LocalStorageCache, CACHE_KEYS } from "@/lib/cache";

// Hook for specialties with localStorage caching
export function useSpecialties() {
  return useQuery({
    queryKey: ['specialties'],
    queryFn: async () => {
      // Try to get from localStorage first
      const cached = LocalStorageCache.get(CACHE_KEYS.SPECIALTIES);
      if (cached) {
        return cached;
      }

      // Fetch from Supabase if not cached
      const { data, error } = await supabase
        .from('specialties')
        .select('id, name, description, color')
        .order('name');

      if (error) throw error;

      // Cache for 24 hours (specialties rarely change)
      LocalStorageCache.set(CACHE_KEYS.SPECIALTIES, data, 24 * 60);
      
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

// Hook for obras sociales with localStorage caching
export function useObrasSociales() {
  return useQuery({
    queryKey: ['obras-sociales'],
    queryFn: async () => {
      // Try to get from localStorage first
      const cached = LocalStorageCache.get(CACHE_KEYS.OBRAS_SOCIALES);
      if (cached) {
        return cached;
      }

      // Fetch from Supabase if not cached
      const { data, error } = await supabase
        .from('obras_sociales_art')
        .select('id, nombre, tipo, is_active')
        .eq('is_active', true)
        .order('nombre');

      if (error) throw error;

      // Cache for 12 hours (obras sociales change occasionally)
      LocalStorageCache.set(CACHE_KEYS.OBRAS_SOCIALES, data, 12 * 60);
      
      return data;
    },
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 12 * 60 * 60 * 1000, // 12 hours
  });
}

// Hook for active doctors with caching
export function useDoctors() {
  return useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id,
          license_number,
          is_active,
          profiles!inner(
            id,
            first_name,
            last_name,
            email
          ),
          specialties!inner(
            id,
            name,
            color
          )
        `)
        .eq('is_active', true)
        .order('profiles.first_name');

      if (error) throw error;

      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}