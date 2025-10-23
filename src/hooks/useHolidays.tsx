import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { format } from "date-fns";

interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  is_national: boolean;
  recurring: boolean;
}

export function useHolidays(startDate?: Date, endDate?: Date) {
  const { currentOrgId } = useOrganizationContext();

  return useQuery({
    queryKey: ['holidays', currentOrgId, startDate, endDate],
    queryFn: async (): Promise<Holiday[]> => {
      if (!currentOrgId) return [];

      let query = supabase
        .from('holidays')
        .select('id, date, name, is_national, recurring')
        .eq('organization_id', currentOrgId)
        .eq('is_active', true);

      if (startDate) {
        query = query.gte('date', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        query = query.lte('date', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query.order('date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
    staleTime: 60 * 60 * 1000, // 1 hora - los feriados no cambian frecuentemente
  });
}
