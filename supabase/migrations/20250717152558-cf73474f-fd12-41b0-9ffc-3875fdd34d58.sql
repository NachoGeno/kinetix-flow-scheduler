-- Agregar campo doctor_name a la tabla medical_orders
ALTER TABLE public.medical_orders 
ADD COLUMN doctor_name TEXT;