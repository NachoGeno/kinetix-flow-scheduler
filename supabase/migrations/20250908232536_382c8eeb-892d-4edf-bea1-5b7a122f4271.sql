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

-- 3. Verificar y crear super admin si es necesario
DO $$
DECLARE
    super_admin_count INTEGER;
    first_admin_id UUID;
BEGIN
    SELECT COUNT(*) INTO super_admin_count
    FROM public.profiles 
    WHERE role = 'super_admin';
    
    IF super_admin_count = 0 THEN
        -- Buscar el primer usuario admin
        SELECT id INTO first_admin_id
        FROM public.profiles 
        WHERE role = 'admin' 
        AND organization_id = 'a0000000-0000-0000-0000-000000000001'
        ORDER BY created_at ASC
        LIMIT 1;
        
        -- Si encontramos un admin, promoverlo a super_admin
        IF first_admin_id IS NOT NULL THEN
            UPDATE public.profiles 
            SET role = 'super_admin'
            WHERE id = first_admin_id;
            
            RAISE NOTICE 'Created super admin from existing admin user: %', first_admin_id;
        ELSE
            RAISE NOTICE 'No admin users found to promote to super_admin';
        END IF;
    ELSE
        RAISE NOTICE 'Super admin already exists: % users', super_admin_count;
    END IF;
END $$;