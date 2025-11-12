import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { LocalStorageCache, CACHE_KEYS } from "@/lib/cache";

export function useDoctors() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['doctors', 'active', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) {
        throw new Error('No organization context available');
      }

      // Try to get from cache first with organization-specific key
      const cacheKey = `${CACHE_KEYS.DOCTORS}_${profile.organization_id}`;
      const cached = LocalStorageCache.get(cacheKey);
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
        .eq('organization_id', profile.organization_id)
        .order('first_name', { foreignTable: 'profiles', ascending: true });

      if (error) throw error;

      const doctors = data.map((doctor: any) => ({
        id: doctor.id,
        name: doctor.profile 
          ? `${doctor.profile.first_name} ${doctor.profile.last_name}`
          : 'Doctor no asignado',
        specialty: doctor.specialty
      }));

      // Cache the result for 10 minutes with organization-specific key
      LocalStorageCache.set(cacheKey, doctors, 10);

      return doctors;
    },
    enabled: !!profile,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}