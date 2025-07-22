-- Crear enum para tipo de entidad
CREATE TYPE public.insurance_type AS ENUM ('obra_social', 'art');

-- Crear tabla para Obras Sociales / ART
CREATE TABLE public.obras_sociales_art (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  cuit TEXT,
  tipo insurance_type NOT NULL,
  domicilio TEXT,
  telefono TEXT,
  email TEXT,
  responsable_contacto TEXT,
  condicion_iva TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.obras_sociales_art ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para obras_sociales_art
CREATE POLICY "Admins can manage all obras_sociales_art" 
ON public.obras_sociales_art 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Doctors can view all obras_sociales_art" 
ON public.obras_sociales_art 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'doctor'::user_role);

CREATE POLICY "Anyone can view active obras_sociales_art" 
ON public.obras_sociales_art 
FOR SELECT 
USING (is_active = true);

-- Agregar campo obra_social_art_id a la tabla patients
ALTER TABLE public.patients 
ADD COLUMN obra_social_art_id UUID REFERENCES public.obras_sociales_art(id);

-- Agregar campo obra_social_art_id a la tabla medical_orders
ALTER TABLE public.medical_orders 
ADD COLUMN obra_social_art_id UUID REFERENCES public.obras_sociales_art(id);

-- Trigger para updated_at en obras_sociales_art
CREATE TRIGGER update_obras_sociales_art_updated_at
BEFORE UPDATE ON public.obras_sociales_art
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función para obtener estadísticas por obra social/ART
CREATE OR REPLACE FUNCTION public.get_stats_by_obra_social(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  obra_social_id UUID,
  obra_social_name TEXT,
  tipo insurance_type,
  pacientes_atendidos BIGINT,
  sesiones_realizadas BIGINT,
  ordenes_medicas BIGINT,
  costo_total NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    osa.id as obra_social_id,
    osa.nombre as obra_social_name,
    osa.tipo,
    COUNT(DISTINCT a.patient_id) as pacientes_atendidos,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as sesiones_realizadas,
    COUNT(DISTINCT mo.id) as ordenes_medicas,
    COALESCE(SUM(CASE 
      WHEN a.status = 'completed' AND vh.valor_por_sesion IS NOT NULL 
      THEN vh.valor_por_sesion 
      ELSE 0 
    END), 0) as costo_total
  FROM public.obras_sociales_art osa
  LEFT JOIN public.patients p ON p.obra_social_art_id = osa.id
  LEFT JOIN public.appointments a ON a.patient_id = p.id
    AND (start_date IS NULL OR a.appointment_date >= start_date)
    AND (end_date IS NULL OR a.appointment_date <= end_date)
  LEFT JOIN public.medical_orders mo ON mo.patient_id = p.id
    AND (start_date IS NULL OR mo.created_at::DATE >= start_date)
    AND (end_date IS NULL OR mo.created_at::DATE <= end_date)
  LEFT JOIN public.valores_honorarios vh ON vh.doctor_id = a.doctor_id
    AND vh.is_active = true
    AND a.appointment_date >= vh.fecha_vigencia_desde
    AND (vh.fecha_vigencia_hasta IS NULL OR a.appointment_date <= vh.fecha_vigencia_hasta)
  WHERE osa.is_active = true
  GROUP BY osa.id, osa.nombre, osa.tipo
  ORDER BY pacientes_atendidos DESC, sesiones_realizadas DESC;
$$;