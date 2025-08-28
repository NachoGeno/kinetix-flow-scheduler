import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TransactionType = 'income' | 'expense';

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface CashTransaction {
  id: string;
  transaction_type: TransactionType;
  amount: number;
  description: string;
  transaction_date: string;
  plus_payment_id?: string;
  patient_id?: string;
  medical_order_id?: string;
  expense_category_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  observations?: string;
  
  // Related data
  expense_category?: ExpenseCategory;
  patient_name?: string;
  plus_payment?: any;
}

export interface DailyCashSummary {
  total_income: number;
  total_expenses: number;
  net_balance: number;
  transaction_count: number;
  last_reconciliation_date?: string;
  is_reconciled: boolean;
}

export interface CashReconciliation {
  id: string;
  reconciliation_date: string;
  opening_balance: number;
  total_income: number;
  total_expenses: number;
  calculated_balance: number;
  physical_count?: number;
  difference?: number;
  is_closed: boolean;
  closed_by?: string;
  closed_at?: string;
  observations?: string;
}

export function useCashTransactions() {
  const [loading, setLoading] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);

  // Fetch expense categories
  const fetchExpenseCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setExpenseCategories(data || []);
    } catch (error) {
      console.error('Error fetching expense categories:', error);
      toast.error('Error al cargar categorías de gastos');
    }
  };

  // Create expense transaction
  const createExpenseTransaction = async (transaction: {
    amount: number;
    description: string;
    transaction_date: string;
    expense_category_id: string;
    observations?: string;
  }) => {
    setLoading(true);
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) throw new Error('Usuario no autenticado');

      // Get current user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser.user.id)
        .single();

      if (!profile) throw new Error('Perfil de usuario no encontrado');

      const { data, error } = await supabase
        .from('cash_transactions')
        .insert({
          transaction_type: 'expense',
          amount: transaction.amount,
          description: transaction.description,
          transaction_date: transaction.transaction_date,
          expense_category_id: transaction.expense_category_id,
          created_by: profile.id,
          observations: transaction.observations,
        })
        .select(`
          *,
          expense_category:expense_categories(*)
        `)
        .single();

      if (error) throw error;

      toast.success('Gasto registrado exitosamente');
      return data;
    } catch (error: any) {
      console.error('Error creating expense transaction:', error);
      toast.error(error.message || 'Error al registrar gasto');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get transactions with filters
  const getTransactions = async (filters?: {
    start_date?: string;
    end_date?: string;
    transaction_type?: TransactionType;
    expense_category_id?: string;
  }) => {
    try {
      let query = supabase
        .from('cash_transactions')
        .select(`
          *,
          expense_category:expense_categories(*),
          plus_payment:plus_payments(*),
          patient:patients(
            id,
            profile:profiles(first_name, last_name)
          )
        `)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.start_date) {
        query = query.gte('transaction_date', filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte('transaction_date', filters.end_date);
      }
      if (filters?.transaction_type) {
        query = query.eq('transaction_type', filters.transaction_type);
      }
      if (filters?.expense_category_id) {
        query = query.eq('expense_category_id', filters.expense_category_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to include patient names
      const transformedData = data?.map(transaction => ({
        ...transaction,
        transaction_type: transaction.transaction_type as TransactionType,
        patient_name: transaction.patient?.profile ? 
          `${transaction.patient.profile.first_name} ${transaction.patient.profile.last_name}` : 
          null
      })) || [];

      return transformedData;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Error al cargar transacciones');
      throw error;
    }
  };

  // Get daily cash summary
  const getDailyCashSummary = async (date?: string): Promise<DailyCashSummary> => {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .rpc('get_daily_cash_summary', { target_date: targetDate });

      if (error) throw error;

      return data[0] || {
        total_income: 0,
        total_expenses: 0,
        net_balance: 0,
        transaction_count: 0,
        is_reconciled: false
      };
    } catch (error) {
      console.error('Error fetching daily cash summary:', error);
      toast.error('Error al cargar resumen diario');
      throw error;
    }
  };

  // Create or update cash reconciliation
  const createCashReconciliation = async (reconciliation: {
    reconciliation_date: string;
    opening_balance: number;
    physical_count: number;
    observations?: string;
  }) => {
    setLoading(true);
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) throw new Error('Usuario no autenticado');

      // Get current user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser.user.id)
        .single();

      if (!profile) throw new Error('Perfil de usuario no encontrado');

      // Get daily summary to calculate totals
      const summary = await getDailyCashSummary(reconciliation.reconciliation_date);
      
      const calculatedBalance = reconciliation.opening_balance + summary.net_balance;
      const difference = reconciliation.physical_count - calculatedBalance;

      const { data, error } = await supabase
        .from('cash_reconciliation')
        .upsert({
          reconciliation_date: reconciliation.reconciliation_date,
          opening_balance: reconciliation.opening_balance,
          total_income: summary.total_income,
          total_expenses: summary.total_expenses,
          calculated_balance: calculatedBalance,
          physical_count: reconciliation.physical_count,
          difference: difference,
          is_closed: true,
          closed_by: profile.id,
          closed_at: new Date().toISOString(),
          observations: reconciliation.observations,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Arqueo de caja completado exitosamente');
      return data;
    } catch (error: any) {
      console.error('Error creating cash reconciliation:', error);
      toast.error(error.message || 'Error al realizar arqueo de caja');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get cash reconciliation for date
  const getCashReconciliation = async (date: string): Promise<CashReconciliation | null> => {
    try {
      const { data, error } = await supabase
        .from('cash_reconciliation')
        .select('*')
        .eq('reconciliation_date', date)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error fetching cash reconciliation:', error);
      return null;
    }
  };

  // Delete transaction
  const deleteTransaction = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('cash_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Transacción eliminada exitosamente');
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast.error(error.message || 'Error al eliminar transacción');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenseCategories();
  }, []);

  return {
    loading,
    expenseCategories,
    createExpenseTransaction,
    getTransactions,
    getDailyCashSummary,
    createCashReconciliation,
    getCashReconciliation,
    deleteTransaction,
    fetchExpenseCategories,
  };
}