-- Add is_active column to patients table for soft deletes
ALTER TABLE public.patients 
ADD COLUMN is_active boolean DEFAULT true;