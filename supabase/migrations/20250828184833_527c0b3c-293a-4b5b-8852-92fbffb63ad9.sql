-- Migración para control de turnos en cash_reconciliation
-- Paso 1: Crear el tipo enum si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_type') THEN
        CREATE TYPE shift_type AS ENUM ('morning', 'afternoon', 'full_day');
    END IF;
END $$;

-- Paso 2: Agregar columnas si no existen
DO $$ 
BEGIN
    -- Agregar shift_type como texto primero
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_reconciliation' AND column_name = 'shift_type') THEN
        ALTER TABLE public.cash_reconciliation ADD COLUMN shift_type TEXT;
        -- Establecer valores por defecto
        UPDATE public.cash_reconciliation SET shift_type = 'full_day' WHERE shift_type IS NULL;
        -- Hacer la columna NOT NULL
        ALTER TABLE public.cash_reconciliation ALTER COLUMN shift_type SET NOT NULL;
    END IF;
    
    -- Agregar shift_start_time si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_reconciliation' AND column_name = 'shift_start_time') THEN
        ALTER TABLE public.cash_reconciliation ADD COLUMN shift_start_time TIME;
    END IF;
    
    -- Agregar shift_end_time si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_reconciliation' AND column_name = 'shift_end_time') THEN
        ALTER TABLE public.cash_reconciliation ADD COLUMN shift_end_time TIME;
    END IF;
    
    -- Agregar previous_balance si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_reconciliation' AND column_name = 'previous_balance') THEN
        ALTER TABLE public.cash_reconciliation ADD COLUMN previous_balance NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Paso 3: Actualizar valores por defecto
UPDATE public.cash_reconciliation 
SET 
    shift_type = 'full_day',
    shift_start_time = '08:00:00', 
    shift_end_time = '20:00:00'
WHERE shift_type IS NULL OR shift_start_time IS NULL;

-- Paso 4: Convertir el tipo de la columna shift_type
ALTER TABLE public.cash_reconciliation 
ALTER COLUMN shift_type TYPE shift_type USING shift_type::shift_type;

-- Paso 5: Agregar constraint único si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_reconciliation_date_shift'
        AND table_name = 'cash_reconciliation'
    ) THEN
        ALTER TABLE public.cash_reconciliation 
        ADD CONSTRAINT unique_reconciliation_date_shift 
        UNIQUE (reconciliation_date, shift_type);
    END IF;
END $$;

-- Paso 6: Crear funciones auxiliares
CREATE OR REPLACE FUNCTION public.get_previous_shift_balance(target_date DATE, current_shift shift_type)
RETURNS NUMERIC
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN current_shift = 'morning' THEN
        COALESCE((
          SELECT calculated_balance 
          FROM cash_reconciliation 
          WHERE reconciliation_date = target_date - INTERVAL '1 day'
          AND shift_type IN ('afternoon', 'full_day')
          AND is_closed = true
          ORDER BY 
            CASE WHEN shift_type = 'afternoon' THEN 1 ELSE 2 END
          LIMIT 1
        ), 0)
      WHEN current_shift = 'afternoon' THEN
        COALESCE((
          SELECT calculated_balance 
          FROM cash_reconciliation 
          WHERE reconciliation_date = target_date
          AND shift_type = 'morning'
          AND is_closed = true
          LIMIT 1
        ), 0)
      ELSE
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