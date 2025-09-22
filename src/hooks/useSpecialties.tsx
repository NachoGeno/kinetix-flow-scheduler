import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { LocalStorageCache, CACHE_KEYS } from "@/lib/cache";

export function useSpecialties() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['specialties', 'active'],
    queryFn: async () => {
      if (!profile) throw new Error('No authenticated user');

      // Try to get from cache first
      const cached = LocalStorageCache.get(CACHE_KEYS.SPECIALTIES);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('specialties')
        .select('id, name, color')
        .order('name');

      if (error) throw error;

      // Cache the result for 15 minutes
      LocalStorageCache.set(CACHE_KEYS.SPECIALTIES, data, 15);

      return data;
    },
    enabled: !!profile,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}