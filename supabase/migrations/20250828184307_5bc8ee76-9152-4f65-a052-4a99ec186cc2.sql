-- Agregar campos para control de turnos a la tabla cash_reconciliation
ALTER TABLE public.cash_reconciliation 
ADD COLUMN shift_type TEXT NOT NULL DEFAULT 'full_day',
ADD COLUMN shift_start_time TIME,
ADD COLUMN shift_end_time TIME,
ADD COLUMN previous_balance NUMERIC DEFAULT 0;

-- Crear tipo enum para shift_type
CREATE TYPE shift_type AS ENUM ('morning', 'afternoon', 'full_day');

-- Cambiar la columna a usar el enum
ALTER TABLE public.cash_reconciliation 
ALTER COLUMN shift_type TYPE shift_type USING shift_type::shift_type;

-- Agregar constraint para evitar duplicados por fecha y turno
ALTER TABLE public.cash_reconciliation 
ADD CONSTRAINT unique_reconciliation_date_shift 
UNIQUE (reconciliation_date, shift_type);

-- Actualizar registros existentes para ser 'full_day'
UPDATE public.cash_reconciliation 
SET shift_type = 'full_day', 
    shift_start_time = '08:00:00', 
    shift_end_time = '20:00:00'
WHERE shift_type IS NULL OR shift_type = 'full_day';

-- Crear función para obtener el balance del turno anterior
CREATE OR REPLACE FUNCTION public.get_previous_shift_balance(target_date DATE, current_shift shift_type)
RETURNS NUMERIC
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN current_shift = 'morning' THEN
        -- Para turno mañana, buscar el balance final del día anterior
        COALESCE((
          SELECT calculated_balance 
          FROM cash_reconciliation 
          WHERE reconciliation_date = target_date - INTERVAL '1 day'
          AND shift_type IN ('afternoon', 'full_day')
          AND is_closed = true
          ORDER BY 
            CASE 
              WHEN shift_type = 'afternoon' THEN 1 
              ELSE 2 
            END
          LIMIT 1
        ), 0)
      WHEN current_shift = 'afternoon' THEN
        -- Para turno tarde, buscar el balance del turno mañana del mismo día
        COALESCE((
          SELECT calculated_balance 
          FROM cash_reconciliation 
          WHERE reconciliation_date = target_date
          AND shift_type = 'morning'
          AND is_closed = true
          LIMIT 1
        ), 0)
      ELSE
        -- Para día completo, buscar el último balance cerrado del día anterior
        COALESCE((
          SELECT calculated_balance 
          FROM cash_reconciliation 
          WHERE reconciliation_date = target_date - INTERVAL '1 day'
          AND is_closed = true
          ORDER BY shift_end_time DESC NULLS LAST
          LIMIT 1
        ), 0)
    END;
$$;

-- Crear función para obtener resumen por turno
CREATE OR REPLACE FUNCTION public.get_shift_cash_summary(
  target_date DATE DEFAULT CURRENT_DATE,
  target_shift shift_type DEFAULT 'full_day',
  start_time TIME DEFAULT '08:00:00',
  end_time TIME DEFAULT '20:00:00'
)
RETURNS TABLE(
  total_income NUMERIC,
  total_expenses NUMERIC,
  net_balance NUMERIC,
  transaction_count BIGINT,
  shift_reconciliation_exists BOOLEAN,
  is_shift_closed BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN ct.transaction_type = 'expense' THEN ct.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE -ct.amount END), 0) as net_balance,
    COUNT(*) as transaction_count,
    EXISTS(
      SELECT 1 FROM cash_reconciliation cr 
      WHERE cr.reconciliation_date = target_date 
      AND cr.shift_type = target_shift
    ) as shift_reconciliation_exists,
    EXISTS(
      SELECT 1 FROM cash_reconciliation cr 
      WHERE cr.reconciliation_date = target_date 
      AND cr.shift_type = target_shift 
      AND cr.is_closed = true
    ) as is_shift_closed
  FROM cash_transactions ct
  WHERE ct.transaction_date = target_date
  AND (
    target_shift = 'full_day' OR
    (target_shift = 'morning' AND ct.created_at::TIME BETWEEN start_time AND end_time) OR
    (target_shift = 'afternoon' AND ct.created_at::TIME BETWEEN start_time AND end_time)
  );
$$;