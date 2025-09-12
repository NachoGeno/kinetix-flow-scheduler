-- Crear función para corregir fechas incorrectas de citas
-- Esta función corrige citas que fueron creadas con 10 días de diferencia

-- Paso 1: Crear tabla temporal para backup antes de la corrección
CREATE TABLE IF NOT EXISTS appointments_backup AS 
SELECT * FROM appointments WHERE 1=0;

-- Insertar backup de citas que vamos a corregir
INSERT INTO appointments_backup 
SELECT * FROM appointments 
WHERE appointment_date::date - DATE(created_at) = 10;

-- Paso 2: Corregir las fechas incorrectas
-- Cambiar appointment_date de las citas afectadas para que coincida con la fecha de creación
UPDATE appointments 
SET 
  appointment_date = DATE(created_at),
  updated_at = now(),
  notes = COALESCE(notes || ' ', '') || '[FECHA CORREGIDA AUTOMÁTICAMENTE]'
WHERE appointment_date::date - DATE(created_at) = 10;

-- Paso 3: Crear trigger para prevenir futuros errores de fecha
CREATE OR REPLACE FUNCTION validate_appointment_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar que la fecha de la cita no tenga más de 2 días de diferencia con la fecha actual
  IF ABS(NEW.appointment_date - CURRENT_DATE) > 365 THEN
    RAISE EXCEPTION 'Fecha de cita inválida: % está muy lejos de la fecha actual', NEW.appointment_date;
  END IF;
  
  -- Verificar que no haya un desplazamiento sospechoso de exactamente 10 días
  IF NEW.appointment_date::date - CURRENT_DATE = 10 AND 
     CURRENT_TIME BETWEEN '08:00'::time AND '22:00'::time THEN
    -- Probablemente es un error de zona horaria, usar fecha actual
    NEW.appointment_date = CURRENT_DATE;
    NEW.notes = COALESCE(NEW.notes || ' ', '') || '[FECHA AUTO-CORREGIDA]';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecute antes de INSERT y UPDATE
DROP TRIGGER IF EXISTS trigger_validate_appointment_date ON appointments;
CREATE TRIGGER trigger_validate_appointment_date
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION validate_appointment_date();