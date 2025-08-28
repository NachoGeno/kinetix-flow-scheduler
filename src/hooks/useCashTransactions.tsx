import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TransactionType = 'income' | 'expense';
export type ShiftType = 'morning' | 'afternoon' | 'full_day';

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

export interface ShiftCashSummary extends DailyCashSummary {
  shift_reconciliation_exists: boolean;
  is_shift_closed: boolean;
}

export interface CashReconciliation {
  id: string;
  reconciliation_date: string;
  shift_type: ShiftType;
  shift_start_time?: string;
  shift_end_time?: string;
  opening_balance: number;
  previous_balance: number;
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

  // Map shift types between TypeScript and database values
  const mapShiftTypeToDb = (shift: ShiftType): 'mañana' | 'tarde' | 'completo' => {
    switch (shift) {
      case 'morning': return 'mañana';
      case 'afternoon': return 'tarde';
      case 'full_day': return 'completo';
      default: return 'completo';
    }
  };

  const mapShiftTypeFromDb = (shift: string): ShiftType => {
    switch (shift) {
      case 'mañana': return 'morning';
      case 'tarde': return 'afternoon';
      case 'completo': return 'full_day';
      default: return 'full_day';
    }
  };

  // Get shift cash summary
  const getShiftCashSummary = async (
    date?: string, 
    shift: ShiftType = 'full_day'
  ): Promise<ShiftCashSummary> => {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('cash_transactions')
        .select('*')
        .eq('transaction_date', targetDate);

      const { data: transactions, error } = await query;
      if (error) throw error;

      // Calculate totals
      const total_income = transactions
        ?.filter(t => t.transaction_type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;
      
      const total_expenses = transactions
        ?.filter(t => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) || 0;

      const net_balance = total_income - total_expenses;
      const transaction_count = transactions?.length || 0;

      // Check if shift reconciliation exists
      const { data: reconciliation } = await supabase
        .from('cash_reconciliation')
        .select('*')
        .eq('reconciliation_date', targetDate)
        .eq('shift_type', mapShiftTypeToDb(shift))
        .single();

      return {
        total_income,
        total_expenses,
        net_balance,
        transaction_count,
        is_reconciled: reconciliation?.is_closed || false,
        shift_reconciliation_exists: !!reconciliation,
        is_shift_closed: reconciliation?.is_closed || false
      };
    } catch (error) {
      console.error('Error fetching shift cash summary:', error);
      throw error;
    }
  };

  // Get previous shift balance
  const getPreviousShiftBalance = async (date: string, shift: ShiftType): Promise<number> => {
    try {
      if (shift === 'morning') {
        // For morning shift, get the previous day's final balance
        const previousDate = new Date(date);
        previousDate.setDate(previousDate.getDate() - 1);
        const prevDateStr = previousDate.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('cash_reconciliation')
          .select('calculated_balance')
          .eq('reconciliation_date', prevDateStr)
          .eq('is_closed', true)
          .in('shift_type', [mapShiftTypeToDb('afternoon'), mapShiftTypeToDb('full_day')])
          .order('shift_end_time', { ascending: false })
          .limit(1);

        if (error && error.code !== 'PGRST116') throw error;
        return data?.[0]?.calculated_balance || 0;
      } else if (shift === 'afternoon') {
        // For afternoon shift, get the morning shift balance of the same day
        const { data, error } = await supabase
          .from('cash_reconciliation')
          .select('calculated_balance')
          .eq('reconciliation_date', date)
          .eq('shift_type', mapShiftTypeToDb('morning'))
          .eq('is_closed', true)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data?.calculated_balance || 0;
      } else {
        // For full day, get the previous day's final balance
        const previousDate = new Date(date);
        previousDate.setDate(previousDate.getDate() - 1);
        const prevDateStr = previousDate.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('cash_reconciliation')
          .select('calculated_balance')
          .eq('reconciliation_date', prevDateStr)
          .eq('is_closed', true)
          .order('shift_end_time', { ascending: false })
          .limit(1);

        if (error && error.code !== 'PGRST116') throw error;
        return data?.[0]?.calculated_balance || 0;
      }
    } catch (error) {
      console.error('Error fetching previous shift balance:', error);
      return 0;
    }
  };

  // Helper function to get shift times
  const getShiftTimes = (shift: ShiftType) => {
    switch (shift) {
      case 'morning':
        return { start: '08:00:00', end: '14:00:00' };
      case 'afternoon':
        return { start: '14:00:00', end: '20:00:00' };
      case 'full_day':
      default:
        return { start: '08:00:00', end: '20:00:00' };
    }
  };

  // Create or update shift cash reconciliation
  const createShiftReconciliation = async (reconciliation: {
    reconciliation_date: string;
    shift_type: ShiftType;
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

      // Get shift summary to calculate totals
      const summary = await getShiftCashSummary(reconciliation.reconciliation_date, reconciliation.shift_type);
      
      const calculatedBalance = reconciliation.opening_balance + summary.net_balance;
      const difference = reconciliation.physical_count - calculatedBalance;
      const shiftTimes = getShiftTimes(reconciliation.shift_type);

      // Get previous shift balance
      const previousBalance = await getPreviousShiftBalance(
        reconciliation.reconciliation_date, 
        reconciliation.shift_type
      );

      const { data, error } = await supabase
        .from('cash_reconciliation')
        .upsert({
          reconciliation_date: reconciliation.reconciliation_date,
          shift_type: mapShiftTypeToDb(reconciliation.shift_type),
          shift_start_time: shiftTimes.start,
          shift_end_time: shiftTimes.end,
          opening_balance: reconciliation.opening_balance,
          previous_balance: previousBalance,
          total_income: summary.total_income,
          total_expenses: summary.total_expenses,
          calculated_balance: calculatedBalance,
          physical_count: reconciliation.physical_count,
          difference: difference,
          is_closed: true,
          closed_by: profile.id,
          closed_at: new Date().toISOString(),
          observations: reconciliation.observations,
        }, { 
          onConflict: 'reconciliation_date,shift_type'
        })
        .select()
        .single();

      if (error) throw error;

      // Transform the returned data to match our TypeScript types
      const transformedData = {
        ...data,
        shift_type: mapShiftTypeFromDb(data.shift_type)
      } as CashReconciliation;

      toast.success('Arqueo de turno completado exitosamente');
      return transformedData;
    } catch (error: any) {
      console.error('Error creating shift reconciliation:', error);
      toast.error(error.message || 'Error al realizar arqueo de turno');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get shift reconciliation for date and shift
  const getShiftReconciliation = async (
    date: string, 
    shift: ShiftType
  ): Promise<CashReconciliation | null> => {
    try {
      const { data, error } = await supabase
        .from('cash_reconciliation')
        .select('*')
        .eq('reconciliation_date', date)
        .eq('shift_type', mapShiftTypeToDb(shift))
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) return null;

      // Transform the data to match our TypeScript types
      return {
        ...data,
        shift_type: mapShiftTypeFromDb(data.shift_type)
      } as CashReconciliation;
    } catch (error) {
      console.error('Error fetching shift reconciliation:', error);
      return null;
    }
  };

  // Create or update cash reconciliation (legacy - now uses full_day shift)
  const createCashReconciliation = async (reconciliation: {
    reconciliation_date: string;
    opening_balance: number;
    physical_count: number;
    observations?: string;
  }) => {
    // Use the shift reconciliation with full_day
    return createShiftReconciliation({
      ...reconciliation,
      shift_type: 'full_day'
    });
  };

  // Get cash reconciliation for date (legacy - looks for full_day shift)
  const getCashReconciliation = async (date: string): Promise<CashReconciliation | null> => {
    return getShiftReconciliation(date, 'full_day');
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
    getShiftCashSummary,
    createCashReconciliation,
    createShiftReconciliation,
    getCashReconciliation,
    getShiftReconciliation,
    getPreviousShiftBalance,
    deleteTransaction,
    fetchExpenseCategories,
  };
}