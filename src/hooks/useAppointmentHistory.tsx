import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppointmentHistory {
  id: string;
  appointment_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  changed_at: string;
  reason: string | null;
  action_type: string;
  reverted_at: string | null;
  reverted_by: string | null;
  revert_reason: string | null;
}

export function useAppointmentHistory(appointmentId: string | null) {
  return useQuery({
    queryKey: ['appointment-history', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return [];
      
      const { data, error } = await supabase
        .from('appointment_status_history')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      return data as AppointmentHistory[];
    },
    enabled: !!appointmentId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useCanUndoAppointment(appointmentId: string | null) {
  const { data: history } = useAppointmentHistory(appointmentId);
  
  if (!history || history.length === 0) return false;
  
  // Get the latest status change (not reversion)
  const latestChange = history.find(h => h.action_type === 'status_change' && !h.reverted_at);
  
  if (!latestChange) return false;
  
  // Check if it was changed within the last 24 hours
  const changeTime = new Date(latestChange.changed_at).getTime();
  const now = Date.now();
  const hoursSinceChange = (now - changeTime) / (1000 * 60 * 60);
  
  // Allow undo within 24 hours and if not already reverted
  return hoursSinceChange <= 24 && !latestChange.reverted_at;
}