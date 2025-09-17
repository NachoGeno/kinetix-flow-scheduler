import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OrderSessionInfo {
  orderId: string;
  totalSessions: number;
  sessionsUsed: number;
  activeAssignments: number;
  sessionsRemaining: number;
  loading: boolean;
  error: string | null;
}

export function useOrderSessionInfo(orderId: string | null): OrderSessionInfo {
  const [info, setInfo] = useState<OrderSessionInfo>({
    orderId: orderId || '',
    totalSessions: 0,
    sessionsUsed: 0,
    activeAssignments: 0,
    sessionsRemaining: 0,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!orderId) {
      setInfo(prev => ({ ...prev, loading: false, error: null }));
      return;
    }

    const fetchSessionInfo = async () => {
      setInfo(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Get basic order info
        const { data: orderData, error: orderError } = await supabase
          .from('medical_orders')
          .select('total_sessions, sessions_used')
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;

        // Get active assignments count
        const { data: activeCount, error: countError } = await supabase
          .rpc('get_active_assignments_count', {
            order_id_param: orderId
          });

        if (countError) throw countError;

        const sessionsRemaining = orderData.total_sessions - (activeCount || 0);

        setInfo({
          orderId,
          totalSessions: orderData.total_sessions,
          sessionsUsed: orderData.sessions_used,
          activeAssignments: activeCount || 0,
          sessionsRemaining: Math.max(0, sessionsRemaining),
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('Error fetching session info:', error);
        setInfo(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
        }));
      }
    };

    fetchSessionInfo();
  }, [orderId]);

  return info;
}