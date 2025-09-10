# EJECUTAR SQL EN SUPABASE DASHBOARD

## Pasos para resolver el problema de especialidades

### 1. Acceder a Supabase Dashboard
- Ve a https://supabase.com
- Haz login con tu cuenta
- Selecciona el proyecto "kinetix-flow-scheduler"

### 2. Abrir SQL Editor
- En el menú lateral izquierdo, busca "SQL Editor"
- Haz clic en "SQL Editor"
- Presiona el botón "New query" (Nueva consulta)

### 3. Ejecutar este SQL

```sql
-- Deshabilitar RLS temporalmente para crear la especialidad
ALTER TABLE public.specialties DISABLE ROW LEVEL SECURITY;

-- Crear la especialidad Kinesiología y Fisioterapia
INSERT INTO public.specialties (
    id, 
    name, 
    description, 
    color, 
    organization_id, 
    created_at, 
    updated_at
) VALUES (
    'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
    'Kinesiología y Fisioterapia',
    'Especialidad enfocada en la rehabilitación física, prevención y tratamiento de lesiones mediante ejercicio terapéutico y técnicas manuales',
    '#3B82F6',
    'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    organization_id = EXCLUDED.organization_id;

-- Rehabilitar RLS
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

-- Verificar que se creó correctamente
SELECT id, name, organization_id FROM public.specialties WHERE name = 'Kinesiología y Fisioterapia';
```

### 4. Ejecutar la consulta
- Copia y pega el SQL completo en el editor
- Presiona el botón "Run" o usa Ctrl+Enter
- Deberías ver un resultado que muestra la especialidad creada

### 5. Probar la creación de profesionales
- Vuelve a tu aplicación
- Recarga la página de profesionales
- Intenta crear un nuevo profesional
- Ahora debería funcionar sin errores

## ¿Qué hace este SQL?
1. Desactiva temporalmente las políticas de seguridad (RLS)
2. Crea la especialidad "Kinesiología y Fisioterapia" con un UUID específico
3. La asigna a tu organización (Rehabilitare San lorenzo)
4. Reactiva las políticas de seguridad
5. Verifica que se creó correctamente

## Después de ejecutar
Una vez ejecutado el SQL, el código de la aplicación ya está preparado para usar esta especialidad y crear profesionales exitosamente.
