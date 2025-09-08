import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PaymentMethod = 'cash' | 'transfer' | 'mercado_pago';

export interface PlusPayment {
  id?: string;
  patient_id: string;
  medical_order_id: string;
  professional_id?: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  collected_by: string;
  observations?: string;
}

export interface DailyStats {
  total_amount: number;
  cash_amount: number;
  transfer_amount: number;
  mercado_pago_amount: number;
  total_payments: number;
}

export interface PlusPaymentReport {
  payment_id: string;
  patient_name: string;
  professional_name: string;
  obra_social_name: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  observations: string;
}

import { useOrganizationContext } from "./useOrganizationContext";

export function usePlusPayments() {
  const { currentOrgId } = useOrganizationContext();
  
  const createPlusPayment = useCallback(async (payment: PlusPayment) => {
    try {
      console.log('Creating plus payment:', payment);
      
      // Verificar que el usuario tenga un perfil antes de crear el payment
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', payment.collected_by)
        .single();

      if (profileError || !profile) {
        console.error('Profile not found for user:', payment.collected_by);
        toast.error('Error: Usuario sin perfil configurado');
        throw new Error('Usuario sin perfil configurado');
      }

      const { data, error } = await supabase
        .from('plus_payments')
        .insert({
          ...payment,
          organization_id: currentOrgId,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Plus payment registrado correctamente');
      return data;
    } catch (error) {
      console.error('Error creating plus payment:', error);
      toast.error('Error al registrar el plus payment');
      throw error;
    }
  }, []);

  const updatePlusPayment = useCallback(async (id: string, updates: Partial<PlusPayment>) => {
    try {
      const { data, error } = await supabase
        .from('plus_payments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Plus payment actualizado correctamente');
      return data;
    } catch (error) {
      console.error('Error updating plus payment:', error);
      toast.error('Error al actualizar el plus payment');
      throw error;
    }
  }, []);

  const deletePlusPayment = useCallback(async (id: string) => {
    try {
      // First delete related cash transactions
      const { error: cashTransactionError } = await supabase
        .from('cash_transactions')
        .delete()
        .eq('plus_payment_id', id);

      if (cashTransactionError) throw cashTransactionError;

      // Then delete the plus payment
      const { error: plusPaymentError } = await supabase
        .from('plus_payments')
        .delete()
        .eq('id', id);

      if (plusPaymentError) throw plusPaymentError;
      
      toast.success('Plus payment eliminado correctamente');
    } catch (error) {
      console.error('Error deleting plus payment:', error);
      toast.error('Error al eliminar el plus payment');
      throw error;
    }
  }, []);

  const getPlusPayments = useCallback(async (filters?: {
    patient_id?: string;
    medical_order_id?: string;
    professional_id?: string;
    payment_date?: string;
  }) => {
    try {
      let query = supabase
        .from('plus_payments')
        .select(`
          *,
          patients!inner(
            id,
            profiles!inner(first_name, last_name)
          ),
          medical_orders!inner(id, description),
          doctors(
            id,
            profiles!inner(first_name, last_name)
          )
        `)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.patient_id) {
        query = query.eq('patient_id', filters.patient_id);
      }
      if (filters?.medical_order_id) {
        query = query.eq('medical_order_id', filters.medical_order_id);
      }
      if (filters?.professional_id) {
        query = query.eq('professional_id', filters.professional_id);
      }
      if (filters?.payment_date) {
        query = query.eq('payment_date', filters.payment_date);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching plus payments:', error);
      toast.error('Error al obtener los plus payments');
      throw error;
    }
  }, []);

  const getDailyStats = useCallback(async (date?: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_daily_plus_stats', { 
          target_date: date || new Date().toISOString().split('T')[0] 
        });

      if (error) throw error;
      return data[0] as DailyStats;
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      toast.error('Error al obtener las estadísticas diarias');
      throw error;
    }
  }, []);

  const getPlusPaymentsReport = useCallback(async (filters?: {
    start_date?: string;
    end_date?: string;
    professional_filter?: string;
    payment_method_filter?: PaymentMethod;
  }) => {
    try {
      const { data, error } = await supabase
        .rpc('get_plus_payments_report', {
          start_date: filters?.start_date || null,
          end_date: filters?.end_date || null,
          professional_filter: filters?.professional_filter || null,
          payment_method_filter: filters?.payment_method_filter || null
        });

      if (error) throw error;
      return data as PlusPaymentReport[];
    } catch (error) {
      console.error('Error fetching plus payments report:', error);
      toast.error('Error al obtener el reporte de plus payments');
      throw error;
    }
  }, []);

  const checkExistingPlusPayment = useCallback(async (medicalOrderId: string) => {
    try {
      const { data, error } = await supabase
        .from('plus_payments')
        .select('id, amount, payment_method, payment_date')
        .eq('medical_order_id', medicalOrderId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking existing plus payment:', error);
      return null;
    }
  }, []);

  return {
    createPlusPayment,
    updatePlusPayment,
    deletePlusPayment,
    getPlusPayments,
    getDailyStats,
    getPlusPaymentsReport,
    checkExistingPlusPayment
  };
}
