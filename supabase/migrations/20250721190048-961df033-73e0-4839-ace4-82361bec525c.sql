-- Crear índice único para asegurar que una orden médica solo pueda pertenecer a un paciente
-- (En realidad ya existe la relación, solo vamos a agregar algunas validaciones adicionales)

-- Agregar validación para total_sessions mayor a 0
ALTER TABLE public.medical_orders 
ADD CONSTRAINT check_total_sessions_positive 
CHECK (total_sessions > 0);

-- Agregar validación para sessions_used no negativo
ALTER TABLE public.medical_orders 
ADD CONSTRAINT check_sessions_used_non_negative 
CHECK (sessions_used >= 0);

-- Agregar validación para que sessions_used no sea mayor que total_sessions
ALTER TABLE public.medical_orders 
ADD CONSTRAINT check_sessions_used_within_total 
CHECK (sessions_used <= total_sessions);

-- Crear índice para mejorar performance en consultas por patient_id
CREATE INDEX IF NOT EXISTS idx_medical_orders_patient_id 
ON public.medical_orders(patient_id);

-- Crear índice para mejorar performance en consultas por completed
CREATE INDEX IF NOT EXISTS idx_medical_orders_completed 
ON public.medical_orders(completed);

-- Crear función para validar que una orden no sea asignada a otro paciente
CREATE OR REPLACE FUNCTION public.validate_medical_order_patient()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se está intentando cambiar el patient_id de una orden existente
  IF TG_OP = 'UPDATE' AND OLD.patient_id != NEW.patient_id THEN
    RAISE EXCEPTION 'Esta orden médica está asignada a otro paciente y no puede reasignarse.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para evitar reasignación de órdenes médicas
CREATE TRIGGER prevent_medical_order_reassignment
  BEFORE UPDATE ON public.medical_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_medical_order_patient();