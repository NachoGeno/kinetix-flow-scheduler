-- FASE 4: Hacer organization_id NOT NULL y completar sistema SaaS
-- (Solo después de que todos los datos estén migrados)

-- 1. Hacer organization_id NOT NULL en todas las tablas principales
-- Profiles
ALTER TABLE public.profiles 
ALTER COLUMN organization_id SET NOT NULL;

-- Patients  
ALTER TABLE public.patients 
ALTER COLUMN organization_id SET NOT NULL;

-- Doctors
ALTER TABLE public.doctors 
ALTER COLUMN organization_id SET NOT NULL;

-- Appointments
ALTER TABLE public.appointments 
ALTER COLUMN organization_id SET NOT NULL;

-- Medical Orders
ALTER TABLE public.medical_orders 
ALTER COLUMN organization_id SET NOT NULL;

-- Obras Sociales
ALTER TABLE public.obras_sociales_art 
ALTER COLUMN organization_id SET NOT NULL;

-- Medical Records
ALTER TABLE public.medical_records 
ALTER COLUMN organization_id SET NOT NULL;

-- Specialties
ALTER TABLE public.specialties 
ALTER COLUMN organization_id SET NOT NULL;

-- Unified Medical Histories
ALTER TABLE public.unified_medical_histories 
ALTER COLUMN organization_id SET NOT NULL;

-- Plus Payments
ALTER TABLE public.plus_payments 
ALTER COLUMN organization_id SET NOT NULL;

-- Cash Transactions
ALTER TABLE public.cash_transactions 
ALTER COLUMN organization_id SET NOT NULL;

-- Novedades
ALTER TABLE public.novedades 
ALTER COLUMN organization_id SET NOT NULL;

-- Expense Categories
ALTER TABLE public.expense_categories 
ALTER COLUMN organization_id SET NOT NULL;

-- 2. Crear función para asignar automáticamente organization_id en nuevos registros
CREATE OR REPLACE FUNCTION public.set_organization_id_from_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Obtener organization_id del usuario actual
    SELECT organization_id INTO NEW.organization_id
    FROM public.profiles 
    WHERE user_id = auth.uid();
    
    -- Si no se encontró organization_id, usar el de Rehabilitare1 por defecto
    IF NEW.organization_id IS NULL THEN
        NEW.organization_id := 'a0000000-0000-0000-0000-000000000001';
    END IF;
    
    RETURN NEW;
END;
$$;

-- 3. Aplicar trigger a tablas que se crean desde el frontend
CREATE TRIGGER set_organization_id_trigger
    BEFORE INSERT ON public.patients
    FOR EACH ROW
    WHEN (NEW.organization_id IS NULL)
    EXECUTE FUNCTION public.set_organization_id_from_user();

CREATE TRIGGER set_organization_id_trigger
    BEFORE INSERT ON public.appointments
    FOR EACH ROW
    WHEN (NEW.organization_id IS NULL)
    EXECUTE FUNCTION public.set_organization_id_from_user();

CREATE TRIGGER set_organization_id_trigger
    BEFORE INSERT ON public.medical_orders
    FOR EACH ROW
    WHEN (NEW.organization_id IS NULL)
    EXECUTE FUNCTION public.set_organization_id_from_user();

CREATE TRIGGER set_organization_id_trigger
    BEFORE INSERT ON public.novedades
    FOR EACH ROW
    WHEN (NEW.organization_id IS NULL)
    EXECUTE FUNCTION public.set_organization_id_from_user();

-- 4. Actualizar función handle_new_user para asignar organization_id
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
        -- Asignar a Rehabilitare1 por defecto para nuevos usuarios
        'a0000000-0000-0000-0000-000000000001'
    );
    RETURN NEW;
END;
$$;