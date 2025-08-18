-- Eliminar el constraint único problemático que está causando duplicados
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointment_datetime_unique;

-- Modificar el trigger para permitir editar órdenes médicas antes de que tengan citas
CREATE OR REPLACE FUNCTION public.validate_medical_order_patient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Si se está intentando cambiar el patient_id de una orden existente
  IF TG_OP = 'UPDATE' AND OLD.patient_id != NEW.patient_id THEN
    -- Solo impedir el cambio si la orden ya tiene citas asociadas
    IF EXISTS (
      SELECT 1 FROM appointments 
      WHERE patient_id = OLD.patient_id 
      AND status IN ('completed', 'scheduled', 'confirmed')
    ) THEN
      RAISE EXCEPTION 'Esta orden médica ya tiene citas asociadas y no puede reasignarse.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;