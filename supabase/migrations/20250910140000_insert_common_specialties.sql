-- Insert common medical specialties that can be used across all organizations
-- These will be available for creating professionals in any organization

-- First, let's insert specialties without organization_id to make them globally available
-- We'll temporarily disable RLS to insert these records

-- Disable RLS temporarily for this operation
ALTER TABLE public.specialties DISABLE ROW LEVEL SECURITY;

-- Insert common specialties with specific UUIDs
INSERT INTO public.specialties (id, name, description, color, organization_id, created_at, updated_at) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kinesiología y Fisioterapia', 'Especialidad enfocada en la rehabilitación física, prevención y tratamiento de lesiones mediante ejercicio terapéutico y técnicas manuales', '#3B82F6', 'a0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('b2c3d4e5-f6g7-8901-bcde-f23456789012', 'Medicina General', 'Atención médica integral y continua para pacientes de todas las edades', '#10B981', 'a0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('c3d4e5f6-g7h8-9012-cdef-345678901234', 'Traumatología', 'Especialidad médica dedicada al estudio de las lesiones del aparato locomotor', '#F59E0B', 'a0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('d4e5f6g7-h8i9-0123-def0-456789012345', 'Neurología', 'Especialidad médica que trata los trastornos del sistema nervioso', '#8B5CF6', 'a0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('e5f6g7h8-i9j0-1234-ef01-567890123456', 'Cardiología', 'Especialidad médica que se ocupa de las afecciones del corazón y del aparato circulatorio', '#EF4444', 'a0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('f6g7h8i9-j0k1-2345-f012-678901234567', 'Psicología', 'Ciencia que estudia la conducta y los procesos mentales', '#EC4899', 'a0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('g7h8i9j0-k1l2-3456-0123-789012345678', 'Nutrición', 'Especialidad que estudia los nutrientes y su relación con la salud', '#84CC16', 'a0000000-0000-0000-0000-000000000001', NOW(), NOW()),
('h8i9j0k1-l2m3-4567-1234-890123456789', 'Fonoaudiología', 'Disciplina que se encarga de la prevención, evaluación y tratamiento de los trastornos de la comunicación humana', '#F97316', 'a0000000-0000-0000-0000-000000000001', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Re-enable RLS
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
