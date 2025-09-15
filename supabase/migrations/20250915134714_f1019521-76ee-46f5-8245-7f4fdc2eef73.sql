-- Eliminar la restricción única actual en license_number
ALTER TABLE public.doctors DROP CONSTRAINT IF EXISTS doctors_license_number_key;

-- Crear nueva restricción única compuesta por license_number y organization_id
-- Esto permite que el mismo número de licencia exista en diferentes organizaciones
ALTER TABLE public.doctors ADD CONSTRAINT doctors_license_number_organization_unique 
UNIQUE (license_number, organization_id);