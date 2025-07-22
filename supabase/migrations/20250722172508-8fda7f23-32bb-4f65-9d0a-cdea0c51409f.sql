-- Crear tabla para valores de honorarios por profesional
CREATE TABLE public.valores_honorarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  valor_por_sesion NUMERIC(10,2) NOT NULL DEFAULT 0,
  fecha_vigencia_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vigencia_hasta DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.valores_honorarios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para valores_honorarios
CREATE POLICY "Admins can manage all valores_honorarios" 
ON public.valores_honorarios 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Doctors can view their own valores_honorarios" 
ON public.valores_honorarios 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM doctors d 
  JOIN profiles p ON d.profile_id = p.id 
  WHERE d.id = valores_honorarios.doctor_id AND p.user_id = auth.uid()
));

-- Crear trigger para updated_at
CREATE TRIGGER update_valores_honorarios_updated_at
BEFORE UPDATE ON public.valores_honorarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función auxiliar para obtener reportes de pacientes atendidos por mes
CREATE OR REPLACE FUNCTION public.get_patients_attended_by_month(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  doctor_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  year INTEGER,
  month INTEGER,
  month_name TEXT,
  patients_attended BIGINT
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    EXTRACT(YEAR FROM a.appointment_date)::INTEGER as year,
    EXTRACT(MONTH FROM a.appointment_date)::INTEGER as month,
    TO_CHAR(a.appointment_date, 'Month') as month_name,
    COUNT(DISTINCT a.patient_id) as patients_attended
  FROM appointments a
  WHERE 
    a.status = 'completed'
    AND (start_date IS NULL OR a.appointment_date >= start_date)
    AND (end_date IS NULL OR a.appointment_date <= end_date)
    AND (doctor_filter IS NULL OR a.doctor_id = doctor_filter)
  GROUP BY 
    EXTRACT(YEAR FROM a.appointment_date),
    EXTRACT(MONTH FROM a.appointment_date),
    TO_CHAR(a.appointment_date, 'Month')
  ORDER BY year DESC, month DESC;
$$;

-- Función para obtener pacientes atendidos por profesional
CREATE OR REPLACE FUNCTION public.get_patients_by_doctor(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  doctor_id UUID,
  doctor_name TEXT,
  patients_attended BIGINT,
  percentage NUMERIC
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH attended_stats AS (
    SELECT 
      a.doctor_id,
      COUNT(DISTINCT a.patient_id) as patients_count
    FROM appointments a
    WHERE 
      a.status = 'completed'
      AND (start_date IS NULL OR a.appointment_date >= start_date)
      AND (end_date IS NULL OR a.appointment_date <= end_date)
    GROUP BY a.doctor_id
  ),
  total_patients AS (
    SELECT SUM(patients_count) as total_count
    FROM attended_stats
  )
  SELECT 
    s.doctor_id,
    CONCAT(p.first_name, ' ', p.last_name) as doctor_name,
    s.patients_count as patients_attended,
    ROUND((s.patients_count::NUMERIC / t.total_count::NUMERIC) * 100, 2) as percentage
  FROM attended_stats s
  CROSS JOIN total_patients t
  JOIN doctors d ON d.id = s.doctor_id
  JOIN profiles p ON p.id = d.profile_id
  ORDER BY s.patients_count DESC;
$$;

-- Función para obtener estadísticas de turnos
CREATE OR REPLACE FUNCTION public.get_appointment_stats(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  doctor_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  percentage NUMERIC
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH stats AS (
    SELECT 
      a.status::TEXT as appointment_status,
      COUNT(*) as status_count
    FROM appointments a
    WHERE 
      (start_date IS NULL OR a.appointment_date >= start_date)
      AND (end_date IS NULL OR a.appointment_date <= end_date)
      AND (doctor_filter IS NULL OR a.doctor_id = doctor_filter)
    GROUP BY a.status
  ),
  total_count AS (
    SELECT SUM(status_count) as total_appointments
    FROM stats
  )
  SELECT 
    s.appointment_status as status,
    s.status_count as count,
    ROUND((s.status_count::NUMERIC / t.total_appointments::NUMERIC) * 100, 2) as percentage
  FROM stats s
  CROSS JOIN total_count t
  ORDER BY s.status_count DESC;
$$;