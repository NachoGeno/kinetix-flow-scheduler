-- Función para obtener lista detallada de pacientes por obra social
CREATE OR REPLACE FUNCTION public.get_patients_list_by_obra_social(
  obra_social_filter UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  patient_dni TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  fecha_registro DATE,
  obra_social_nombre TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as patient_id,
    CONCAT(pr.first_name, ' ', pr.last_name) as patient_name,
    pr.dni as patient_dni,
    pr.email as patient_email,
    pr.phone as patient_phone,
    p.created_at::date as fecha_registro,
    COALESCE(os.nombre, 'Sin Obra Social') as obra_social_nombre
  FROM patients p
  INNER JOIN profiles pr ON p.profile_id = pr.id
  LEFT JOIN obras_sociales_art os ON p.obra_social_art_id = os.id
  WHERE p.is_active = true
    AND p.organization_id = get_current_user_organization_id()
    AND (obra_social_filter IS NULL OR p.obra_social_art_id = obra_social_filter)
    AND (start_date IS NULL OR p.created_at::date >= start_date)
    AND (end_date IS NULL OR p.created_at::date <= end_date)
  ORDER BY pr.last_name, pr.first_name;
END;
$$;