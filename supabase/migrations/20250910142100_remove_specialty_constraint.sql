-- Temporarily remove the foreign key constraint on specialty_id
-- This allows creating doctors without worrying about specialty existence

-- Drop the foreign key constraint
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_specialty_id_fkey;

-- Make specialty_id nullable temporarily
ALTER TABLE public.doctors ALTER COLUMN specialty_id DROP NOT NULL;

-- Add a text field for specialty name as backup
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS specialty_name TEXT;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_doctors_specialty_name ON public.doctors(specialty_name);
