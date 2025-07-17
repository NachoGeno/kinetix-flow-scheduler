-- Hacer que doctor_id sea opcional en medical_orders
ALTER TABLE public.medical_orders 
ALTER COLUMN doctor_id DROP NOT NULL;