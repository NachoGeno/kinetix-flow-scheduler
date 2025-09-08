-- FASE 1: Migrar todos los datos existentes a "Rehabilitare1"
-- (100% seguro - solo asigna organización por defecto)

-- 1. Asignar TODOS los profiles existentes a Rehabilitare1
UPDATE public.profiles 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- 2. Agregar organization_id a otras tablas principales
-- Pacientes
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Doctores
ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Citas
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Órdenes médicas
ALTER TABLE public.medical_orders 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Obras sociales
ALTER TABLE public.obras_sociales_art 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Registros médicos
ALTER TABLE public.medical_records 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Especialidades
ALTER TABLE public.specialties 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Historias médicas unificadas
ALTER TABLE public.unified_medical_histories 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Plus payments
ALTER TABLE public.plus_payments 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Transacciones de efectivo
ALTER TABLE public.cash_transactions 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Novedades
ALTER TABLE public.novedades 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Categorías de gastos
ALTER TABLE public.expense_categories 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 3. Migrar TODOS los datos existentes a Rehabilitare1
-- Pacientes
UPDATE public.patients 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Doctores  
UPDATE public.doctors 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Citas
UPDATE public.appointments 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Órdenes médicas
UPDATE public.medical_orders 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Obras sociales
UPDATE public.obras_sociales_art 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Registros médicos
UPDATE public.medical_records 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Especialidades
UPDATE public.specialties 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Historias médicas unificadas  
UPDATE public.unified_medical_histories 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Plus payments
UPDATE public.plus_payments 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Transacciones de efectivo
UPDATE public.cash_transactions 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Novedades
UPDATE public.novedades 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Categorías de gastos
UPDATE public.expense_categories 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;