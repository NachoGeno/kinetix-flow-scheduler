-- Migración simple para control de turnos
-- Solo agregar las columnas necesarias

-- Crear el tipo enum si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_type') THEN
        CREATE TYPE shift_type AS ENUM ('morning', 'afternoon', 'full_day');
    END IF;
END $$;

-- Agregar columnas si no existen
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_reconciliation' AND column_name = 'shift_type') THEN
        ALTER TABLE public.cash_reconciliation ADD COLUMN shift_type TEXT;
        UPDATE public.cash_reconciliation SET shift_type = 'full_day' WHERE shift_type IS NULL;
        ALTER TABLE public.cash_reconciliation ALTER COLUMN shift_type SET NOT NULL;
        ALTER TABLE public.cash_reconciliation ALTER COLUMN shift_type TYPE shift_type USING shift_type::shift_type;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_reconciliation' AND column_name = 'shift_start_time') THEN
        ALTER TABLE public.cash_reconciliation ADD COLUMN shift_start_time TIME;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_reconciliation' AND column_name = 'shift_end_time') THEN
        ALTER TABLE public.cash_reconciliation ADD COLUMN shift_end_time TIME;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_reconciliation' AND column_name = 'previous_balance') THEN
        ALTER TABLE public.cash_reconciliation ADD COLUMN previous_balance NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Actualizar valores por defecto
UPDATE public.cash_reconciliation 
SET 
    shift_start_time = '08:00:00', 
    shift_end_time = '20:00:00'
WHERE shift_start_time IS NULL;

-- Agregar constraint único si no existe
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