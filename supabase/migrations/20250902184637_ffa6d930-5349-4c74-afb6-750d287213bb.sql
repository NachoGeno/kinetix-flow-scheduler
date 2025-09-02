-- Add order_date column to medical_orders table
ALTER TABLE public.medical_orders 
ADD COLUMN order_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Update existing records to use created_at date as order_date
UPDATE public.medical_orders 
SET order_date = created_at::DATE 
WHERE order_date IS NULL;