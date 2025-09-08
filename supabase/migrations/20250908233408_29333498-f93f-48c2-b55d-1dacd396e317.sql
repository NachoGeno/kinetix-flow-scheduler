-- Hacer organization_id nullable temporalmente mientras los triggers se establecen correctamente
-- Los triggers automáticamente asignarán el organization_id correcto

-- 1. Appointments
ALTER TABLE public.appointments ALTER COLUMN organization_id DROP NOT NULL;

-- 2. Medical Orders  
ALTER TABLE public.medical_orders ALTER COLUMN organization_id DROP NOT NULL;

-- 3. Unified Medical Histories
ALTER TABLE public.unified_medical_histories ALTER COLUMN organization_id DROP NOT NULL;

-- 4. Novedades
ALTER TABLE public.novedades ALTER COLUMN organization_id DROP NOT NULL;

-- 5. Verificar que los triggers están funcionando
SELECT 
    schemaname,
    tablename,
    triggername,
    tgtype,
    tgenabled
FROM pg_trigger pt
JOIN pg_class pc ON pt.tgrelid = pc.oid
JOIN pg_namespace pn ON pc.relnamespace = pn.oid
WHERE pn.nspname = 'public' 
AND pt.tgname = 'set_organization_id_trigger'
AND pt.tgenabled = 'O'
ORDER BY tablename;