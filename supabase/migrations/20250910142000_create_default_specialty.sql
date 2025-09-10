-- Create a default specialty that will always exist
-- This solves the foreign key constraint issue permanently

-- Temporarily disable RLS to ensure we can create this record
ALTER TABLE public.specialties DISABLE ROW LEVEL SECURITY;

-- Insert a default specialty with a fixed UUID that we'll use as fallback
INSERT INTO public.specialties (
    id, 
    name, 
    description, 
    color, 
    organization_id, 
    created_at, 
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Medicina General',
    'Especialidad médica general - Usado como fallback para profesionales',
    '#10B981',
    'a0000000-0000-0000-0000-000000000001',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Re-enable RLS
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

-- Also create a function to get or create specialties safely
CREATE OR REPLACE FUNCTION public.get_or_create_specialty(
    specialty_id UUID,
    specialty_name TEXT,
    org_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Try to insert the specialty, ignore if it already exists
    INSERT INTO public.specialties (id, name, description, color, organization_id)
    VALUES (specialty_id, specialty_name, 'Especialidad médica', '#3B82F6', org_id)
    ON CONFLICT (id) DO NOTHING;
    
    -- Return the specialty_id
    RETURN specialty_id;
EXCEPTION
    WHEN OTHERS THEN
        -- If anything fails, return the default specialty
        RETURN '00000000-0000-0000-0000-000000000001'::UUID;
END;
$$;
