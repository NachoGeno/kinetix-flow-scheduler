-- Crear función para cancelar turnos al eliminar paciente
CREATE OR REPLACE FUNCTION public.cancel_patient_appointments_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo proceder si el paciente está siendo desactivado (eliminado)
  IF OLD.is_active = true AND NEW.is_active = false THEN
    
    -- Verificar si el paciente tiene citas completadas (ha asistido a sesiones)
    IF EXISTS (
      SELECT 1 
      FROM public.appointments 
      WHERE patient_id = NEW.id 
      AND status = 'completed'
    ) THEN
      -- Si tiene citas completadas, no cancelar ningún turno
      -- Solo registrar en logs si fuera necesario
      RAISE NOTICE 'Paciente % tiene sesiones completadas, no se cancelan turnos', NEW.id;
    ELSE
      -- Si no tiene citas completadas, cancelar todos los turnos programados
      UPDATE public.appointments 
      SET status = 'cancelled'
      WHERE patient_id = NEW.id 
      AND status IN ('scheduled', 'confirmed', 'in_progress');
      
      RAISE NOTICE 'Turnos cancelados para paciente % sin sesiones completadas', NEW.id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger que se ejecute al actualizar la tabla patients
CREATE OR REPLACE TRIGGER trigger_cancel_appointments_on_patient_delete
  AFTER UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.cancel_patient_appointments_on_delete();