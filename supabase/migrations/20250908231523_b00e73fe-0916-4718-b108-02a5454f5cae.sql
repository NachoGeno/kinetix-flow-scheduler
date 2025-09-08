-- FASE 4B: Completar organización NOT NULL y triggers (sin duplicados)

-- 1. Hacer organization_id NOT NULL en tablas que falten
DO $$
DECLARE
    table_name TEXT;
    tables_to_update TEXT[] := ARRAY['profiles', 'patients', 'doctors', 'appointments', 'medical_orders', 
                                   'obras_sociales_art', 'medical_records', 'specialties', 
                                   'unified_medical_histories', 'plus_payments', 'cash_transactions', 
                                   'novedades', 'expense_categories'];
BEGIN
    FOREACH table_name IN ARRAY tables_to_update
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL;', table_name);
            RAISE NOTICE 'Updated table: %', table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Table % already has NOT NULL constraint or error: %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 2. Crear función mejorada para asignar organization_id
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

-- 3. Aplicar triggers con DROP IF EXISTS para evitar duplicados
DO $$
DECLARE
    table_name TEXT;
    trigger_tables TEXT[] := ARRAY['patients', 'appointments', 'medical_orders', 'novedades'];
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
            
        RAISE NOTICE 'Created trigger for table: %', table_name;
    END LOOP;
END $$;

-- 4. Actualizar función handle_new_user para incluir organization_id
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, first_name, last_name, email, role, organization_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuario'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nuevo'),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'patient'),
        'a0000000-0000-0000-0000-000000000001'
    );
    RETURN NEW;
END;
$$;

-- Recrear trigger para nuevos usuarios
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();