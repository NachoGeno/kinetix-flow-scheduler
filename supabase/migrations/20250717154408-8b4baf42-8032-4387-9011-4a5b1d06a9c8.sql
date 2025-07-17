-- Agregar campo para rastrear sesiones usadas
ALTER TABLE public.medical_orders 
ADD COLUMN sessions_used INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN total_sessions INTEGER DEFAULT 1 NOT NULL;