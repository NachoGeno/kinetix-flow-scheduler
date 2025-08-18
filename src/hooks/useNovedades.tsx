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
          *,
          profiles:autor_id (
            first_name,
            last_name
          )
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

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching novedades:", error);
        throw error;
      }

      return data || [];
    },
  });
}

export function useNovedadesToday() {
  const today = new Date().toISOString().split('T')[0];
  return useNovedades({ fecha: today });
}