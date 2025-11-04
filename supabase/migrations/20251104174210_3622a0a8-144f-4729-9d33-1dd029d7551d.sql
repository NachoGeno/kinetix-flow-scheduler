-- Función para obtener distribución de pacientes por obra social
CREATE OR REPLACE FUNCTION public.get_patients_by_obra_social(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  obra_social_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  obra_social_id UUID,
  obra_social_nombre TEXT,
  total_pacientes BIGINT,
  porcentaje NUMERIC
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH patient_counts AS (
    SELECT 
      os.id as obra_social_id,
      os.nombre as obra_social_nombre,
      COUNT(DISTINCT p.id) as total_pacientes
    FROM patients p
    LEFT JOIN obras_sociales_art os ON p.obra_social_art_id = os.id
    WHERE p.is_active = true
      AND p.organization_id = get_current_user_organization_id()
      AND (obra_social_filter IS NULL OR p.obra_social_art_id = obra_social_filter)
      AND (start_date IS NULL OR p.created_at::date >= start_date)
      AND (end_date IS NULL OR p.created_at::date <= end_date)
    GROUP BY os.id, os.nombre
  ),
  total AS (
    SELECT SUM(total_pacientes) as grand_total FROM patient_counts
  )
  SELECT 
    pc.obra_social_id,
    COALESCE(pc.obra_social_nombre, 'Sin Obra Social') as obra_social_nombre,
    pc.total_pacientes,
    ROUND((pc.total_pacientes::numeric / NULLIF(t.grand_total, 0)) * 100, 2) as porcentaje
  FROM patient_counts pc
  CROSS JOIN total t
  ORDER BY pc.total_pacientes DESC;
END;
$$;