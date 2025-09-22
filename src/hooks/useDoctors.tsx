import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { LocalStorageCache, CACHE_KEYS } from "@/lib/cache";

export function useDoctors() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['doctors', 'active'],
    queryFn: async () => {
      if (!profile) throw new Error('No authenticated user');

      // Try to get from cache first
      const cached = LocalStorageCache.get(CACHE_KEYS.DOCTORS);
      if (cached) return cached;

      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id,
          profile:profiles(
            first_name,
            last_name
          ),
          specialty:specialties(
            id,
            name,
            color
          )
        `)
        .eq('is_active', true)
        .order('profile(first_name)');

      if (error) throw error;

      const doctors = data.map((doctor: any) => ({
        id: doctor.id,
        name: doctor.profile 
          ? `${doctor.profile.first_name} ${doctor.profile.last_name}`
          : 'Doctor no asignado',
        specialty: doctor.specialty
      }));

      // Cache the result for 10 minutes
      LocalStorageCache.set(CACHE_KEYS.DOCTORS, doctors, 10);

      return doctors;
    },
    enabled: !!profile,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}