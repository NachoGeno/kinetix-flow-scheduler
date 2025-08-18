import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePatientNoShows(patientId: string | null) {
  const [noShowCount, setNoShowCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setNoShowCount(0);
      return;
    }

    const fetchNoShowCount = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('id')
          .eq('patient_id', patientId)
          .in('status', ['no_show', 'no_show_rescheduled', 'no_show_session_lost'])
          .is('pardoned_by', null); // Only count non-pardoned no-shows

        if (error) {
          console.error('Error fetching no-show count:', error);
          return;
        }

        setNoShowCount(data?.length || 0);
      } catch (error) {
        console.error('Error in usePatientNoShows:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNoShowCount();
  }, [patientId]);

  return { noShowCount, loading };
}

export function usePatientNoShowsMultiple(patientIds: string[]) {
  const [noShowCounts, setNoShowCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (patientIds.length === 0) {
      setNoShowCounts({});
      return;
    }

    const fetchNoShowCounts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('patient_id')
          .in('patient_id', patientIds)
          .in('status', ['no_show', 'no_show_rescheduled', 'no_show_session_lost'])
          .is('pardoned_by', null); // Only count non-pardoned no-shows

        if (error) {
          console.error('Error fetching no-show counts:', error);
          return;
        }

        // Count no-shows per patient
        const counts: Record<string, number> = {};
        patientIds.forEach(id => {
          counts[id] = data?.filter(appointment => appointment.patient_id === id).length || 0;
        });

        setNoShowCounts(counts);
      } catch (error) {
        console.error('Error in usePatientNoShowsMultiple:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNoShowCounts();
  }, [patientIds.join(',')]);

  return { noShowCounts, loading };
}