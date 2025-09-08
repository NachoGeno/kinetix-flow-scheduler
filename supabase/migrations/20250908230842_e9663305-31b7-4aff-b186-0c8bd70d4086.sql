-- FASE 0 - PARTE 3: Completar la estructura organizacional
-- (solo agregar lo que falta)

-- 1. Insertar organización por defecto "Rehabilitare1" si no existe
INSERT INTO public.organizations (
    id,
    name,
    subdomain,
    contact_email,
    is_active,
    plan_type,
    max_users,
    max_patients
) 
SELECT 
    'a0000000-0000-0000-0000-000000000001',
    'Rehabilitare1',
    'rehabilitare1',
    'admin@rehabilitare1.com',
    true,
    'enterprise',
    100,
    5000
WHERE NOT EXISTS (
    SELECT 1 FROM public.organizations WHERE id = 'a0000000-0000-0000-0000-000000000001'
);

-- 2. Agregar organization_id a profiles si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
    END IF;
END $$;

-- 3. Crear funciones helper si no existen
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id 
    FROM public.profiles 
    WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.user_id = $1 AND role = 'super_admin'
    );
$$;

-- 4. Habilitar RLS en organizations si no está habilitado
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS para organizations si no existen
DO $$
BEGIN
    -- Política para super_admin
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND policyname = 'Super admins can manage all organizations'
    ) THEN
        CREATE POLICY "Super admins can manage all organizations" 
        ON public.organizations 
        FOR ALL 
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE user_id = auth.uid() AND role = 'super_admin'
            )
        );
    END IF;

    -- Política para usuarios ver su organización
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND policyname = 'Users can view their own organization'
    ) THEN
        CREATE POLICY "Users can view their own organization" 
        ON public.organizations 
        FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE user_id = auth.uid() AND organization_id = organizations.id
            )
        );
    END IF;
END $$;

-- 6. Crear trigger para updated_at si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_organizations_updated_at'
    ) THEN
        CREATE TRIGGER update_organizations_updated_at
            BEFORE UPDATE ON public.organizations
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;