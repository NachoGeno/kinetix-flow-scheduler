-- Corregir función para incluir search_path seguro
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
SET search_path = 'public'
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