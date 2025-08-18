import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface NovedadesFilters {
  fecha?: string;
  turno?: string;
  categoria?: string;
  autor?: string;
}

export function useNovedades(filters: NovedadesFilters = {}) {
  return useQuery({
    queryKey: ["novedades", filters],
    queryFn: async () => {
      let query = supabase
        .from("novedades")
        .select(`
          *
        `)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters.fecha) {
        query = query.eq("fecha", filters.fecha);
      }
      
      if (filters.turno) {
        query = query.eq("turno", filters.turno as any);
      }
      
      if (filters.categoria) {
        query = query.eq("categoria", filters.categoria as any);
      }
      
      if (filters.autor) {
        query = query.eq("autor_id", filters.autor);
      }

      const { data: novedadesData, error } = await query;

      if (error) {
        console.error("Error fetching novedades:", error);
        throw error;
      }

      // Get author profiles separately
      const authorIds = [...new Set(novedadesData?.map(n => n.autor_id) || [])];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", authorIds);

      // Combine data
      const novedadesWithProfiles = novedadesData?.map(novedad => ({
        ...novedad,
        profiles: profiles?.find(p => p.id === novedad.autor_id) || null
      })) || [];

      return novedadesWithProfiles;
    },
  });
}

export function useNovedadesToday() {
  const today = new Date().toISOString().split('T')[0];
  return useNovedades({ fecha: today });
}