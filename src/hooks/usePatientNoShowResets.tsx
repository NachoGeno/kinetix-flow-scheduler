import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NoShowResetInfo {
  id: string;
  reset_date: string;
  reason?: string;
  appointments_affected: number;
  reset_by: string;
}

export function usePatientNoShowResets(patientId: string | null) {
  const [resets, setResets] = useState<NoShowResetInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setResets([]);
      return;
    }

    const fetchResets = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('patient_noshow_resets')
          .select(`
            id,
            reset_date,
            reason,
            appointments_affected,
            reset_by
          `)
          .eq('patient_id', patientId)
          .order('reset_date', { ascending: false });

        if (error) {
          console.error('Error fetching no-show resets:', error);
          return;
        }

        setResets(data || []);
      } catch (error) {
        console.error('Error in usePatientNoShowResets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResets();
  }, [patientId]);

  return { resets, loading };
}