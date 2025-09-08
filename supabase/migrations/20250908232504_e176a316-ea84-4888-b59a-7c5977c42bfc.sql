-- FASE 1: Arreglar triggers automáticos para organization_id

-- 1. Crear/actualizar función para asignar organization_id automáticamente
CREATE OR REPLACE FUNCTION public.set_organization_id_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Si organization_id no está seteado, obtenerlo del usuario actual
    IF NEW.organization_id IS NULL THEN
        SELECT organization_id INTO NEW.organization_id
        FROM public.profiles 
        WHERE user_id = auth.uid();
        
        -- Si aún no se encontró, usar Rehabilitare1 por defecto
        IF NEW.organization_id IS NULL THEN
            NEW.organization_id := 'a0000000-0000-0000-0000-000000000001';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2. Aplicar triggers a todas las tablas necesarias (con DROP IF EXISTS para evitar duplicados)
DO $$
DECLARE
    table_name TEXT;
    trigger_tables TEXT[] := ARRAY['appointments', 'medical_orders', 'unified_medical_histories', 'novedades'];
BEGIN
    FOREACH table_name IN ARRAY trigger_tables
    LOOP
        -- Eliminar trigger existente si existe
        EXECUTE format('DROP TRIGGER IF EXISTS set_organization_id_trigger ON public.%I;', table_name);
        
        -- Crear trigger nuevo
        EXECUTE format('CREATE TRIGGER set_organization_id_trigger
            BEFORE INSERT ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION public.set_organization_id_from_user();', table_name);
            
        RAISE NOTICE 'Applied trigger to table: %', table_name;
    END LOOP;
END $$;

-- 3. Verificar que el super admin existe
DO $$
DECLARE
    super_admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO super_admin_count
    FROM public.profiles 
    WHERE role = 'super_admin';
    
    IF super_admin_count = 0 THEN
        -- Si no existe super admin, crear uno con el primer usuario admin
        UPDATE public.profiles 
        SET role = 'super_admin'
        WHERE role = 'admin' 
        AND organization_id = 'a0000000-0000-0000-0000-000000000001'
        LIMIT 1;
        
        RAISE NOTICE 'Created super admin from existing admin user';
    ELSE
        RAISE NOTICE 'Super admin already exists: % users', super_admin_count;
    END IF;
END $$;

-- 4. Mostrar resumen del estado actual
SELECT 
    'Super Admins' as type, 
    COUNT(*) as count, 
    STRING_AGG(email, ', ') as emails
FROM public.profiles 
WHERE role = 'super_admin'
UNION ALL
SELECT 
    'Organizations' as type, 
    COUNT(*) as count, 
    STRING_AGG(name, ', ') as names
FROM public.organizations 
WHERE is_active = true;