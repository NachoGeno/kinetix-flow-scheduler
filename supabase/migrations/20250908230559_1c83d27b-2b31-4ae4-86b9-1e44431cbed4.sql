-- FASE 0 - PARTE 2: Crear tabla organizations y estructura base
-- (super_admin ya existe en el enum)

-- 1. Crear tabla organizations
CREATE TABLE public.organizations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    max_users INTEGER DEFAULT 50,
    max_patients INTEGER DEFAULT 1000,
    plan_type TEXT DEFAULT 'basic',
    logo_url TEXT,
    primary_color TEXT DEFAULT '#3B82F6',
    secondary_color TEXT DEFAULT '#1E40AF'
);

-- 2. Habilitar RLS en organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas RLS para organizations (solo super_admin puede gestionar)
CREATE POLICY "Super admins can manage all organizations" 
ON public.organizations 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND role = 'super_admin'
    )
);

CREATE POLICY "Users can view their own organization" 
ON public.organizations 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND organization_id = organizations.id
    )
);

-- 4. Crear trigger para updated_at en organizations
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Insertar organización por defecto "Rehabilitare1"
INSERT INTO public.organizations (
    id,
    name,
    subdomain,
    contact_email,
    is_active,
    plan_type,
    max_users,
    max_patients
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Rehabilitare1',
    'rehabilitare1',
    'admin@rehabilitare1.com',
    true,
    'enterprise',
    100,
    5000
);

-- 6. Agregar organization_id a profiles (nullable por ahora para no romper nada)
ALTER TABLE public.profiles 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- 7. Crear función helper para obtener organization_id del usuario actual
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

-- 8. Crear función helper para verificar si es super_admin
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