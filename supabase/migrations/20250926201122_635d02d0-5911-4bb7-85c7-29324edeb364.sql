-- FASE 3: Schema Reporting - Estructura Base
-- Crear schema reporting
CREATE SCHEMA IF NOT EXISTS reporting;

-- Crear rol report_reader con acceso de solo lectura al schema reporting
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'report_reader') THEN
        CREATE ROLE report_reader NOLOGIN;
    END IF;
END $$;

-- Otorgar permisos de solo lectura al rol report_reader
GRANT USAGE ON SCHEMA reporting TO report_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO report_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT SELECT ON TABLES TO report_reader;

-- Función de seguridad para validar acceso a reportes
CREATE OR REPLACE FUNCTION public.can_access_reports()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'reports_manager')
    );
$$;