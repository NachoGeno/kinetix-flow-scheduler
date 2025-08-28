-- Create expense categories table
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create cash transactions table (for both income and expenses)
CREATE TABLE public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- For income transactions (linked to plus payments)
  plus_payment_id UUID REFERENCES public.plus_payments(id),
  patient_id UUID REFERENCES public.patients(id),
  medical_order_id UUID REFERENCES public.medical_orders(id),
  
  -- For expense transactions
  expense_category_id UUID REFERENCES public.expense_categories(id),
  
  -- Common fields
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observations TEXT
);

-- Create cash reconciliation table (enhanced from daily_cash_control)
CREATE TABLE public.cash_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Opening balance
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  
  -- Calculated totals from transactions
  total_income NUMERIC NOT NULL DEFAULT 0,
  total_expenses NUMERIC NOT NULL DEFAULT 0,
  calculated_balance NUMERIC NOT NULL DEFAULT 0,
  
  -- Physical count
  physical_count NUMERIC,
  difference NUMERIC,
  
  -- Status and closure
  is_closed BOOLEAN NOT NULL DEFAULT false,
  closed_by UUID REFERENCES public.profiles(id),
  closed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observations TEXT,
  
  UNIQUE(reconciliation_date)
);

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_reconciliation ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_categories
CREATE POLICY "Admins and reception can manage expense categories"
ON public.expense_categories
FOR ALL
USING (can_manage_plus_payments());

CREATE POLICY "Authenticated users can view active expense categories"
ON public.expense_categories
FOR SELECT
USING (is_active = true);

-- RLS Policies for cash_transactions
CREATE POLICY "Admins and reception can manage cash transactions"
ON public.cash_transactions
FOR ALL
USING (can_manage_plus_payments());

CREATE POLICY "Doctors can view their related transactions"
ON public.cash_transactions
FOR SELECT
USING (
  transaction_type = 'income' AND 
  EXISTS (
    SELECT 1 FROM plus_payments pp
    JOIN doctors d ON pp.professional_id = d.id
    JOIN profiles p ON d.profile_id = p.id
    WHERE pp.id = cash_transactions.plus_payment_id
    AND p.user_id = auth.uid()
  )
);

-- RLS Policies for cash_reconciliation
CREATE POLICY "Admins and reception can manage cash reconciliation"
ON public.cash_reconciliation
FOR ALL
USING (can_manage_plus_payments());

-- Insert default expense categories
INSERT INTO public.expense_categories (name, description) VALUES
('Insumos Médicos', 'Gastos en materiales y suministros médicos'),
('Mantenimiento', 'Gastos de mantenimiento y reparaciones'),
('Servicios', 'Gastos en servicios (luz, agua, gas, internet)'),
('Limpieza', 'Productos y servicios de limpieza'),
('Papelería', 'Materiales de oficina y papelería'),
('Transporte', 'Gastos de transporte y combustible'),
('Varios', 'Gastos varios no categorizados');

-- Create function to automatically create income transactions from plus payments
CREATE OR REPLACE FUNCTION public.create_income_transaction_from_plus_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only create transaction for cash payments
  IF NEW.payment_method = 'cash' THEN
    INSERT INTO public.cash_transactions (
      transaction_type,
      amount,
      description,
      transaction_date,
      plus_payment_id,
      patient_id,
      medical_order_id,
      created_by
    )
    VALUES (
      'income',
      NEW.amount,
      'Ingreso por Plus Payment - ' || COALESCE((
        SELECT CONCAT(pr.first_name, ' ', pr.last_name)
        FROM patients p
        JOIN profiles pr ON p.profile_id = pr.id
        WHERE p.id = NEW.patient_id
      ), 'Paciente'),
      NEW.payment_date,
      NEW.id,
      NEW.patient_id,
      NEW.medical_order_id,
      NEW.collected_by
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic income transaction creation
CREATE TRIGGER create_income_transaction_trigger
  AFTER INSERT ON public.plus_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_income_transaction_from_plus_payment();

-- Create function to get daily cash summary
CREATE OR REPLACE FUNCTION public.get_daily_cash_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  total_income NUMERIC,
  total_expenses NUMERIC,
  net_balance NUMERIC,
  transaction_count BIGINT,
  last_reconciliation_date DATE,
  is_reconciled BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END), 0) as net_balance,
    COUNT(*) as transaction_count,
    (SELECT MAX(reconciliation_date) FROM cash_reconciliation WHERE is_closed = true) as last_reconciliation_date,
    EXISTS(SELECT 1 FROM cash_reconciliation WHERE reconciliation_date = target_date AND is_closed = true) as is_reconciled
  FROM cash_transactions 
  WHERE transaction_date = target_date;
$$;