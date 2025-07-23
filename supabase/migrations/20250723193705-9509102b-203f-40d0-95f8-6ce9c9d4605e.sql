-- Crear el bucket para órdenes médicas si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-orders', 'medical-orders', true)
ON CONFLICT (id) DO NOTHING;

-- Crear políticas para permitir el acceso a los archivos de órdenes médicas
CREATE POLICY "Usuarios autenticados pueden ver órdenes médicas"
ON storage.objects
FOR SELECT
USING (bucket_id = 'medical-orders' AND auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden subir órdenes médicas"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'medical-orders' AND auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar órdenes médicas"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'medical-orders' AND auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar órdenes médicas"
ON storage.objects
FOR DELETE
USING (bucket_id = 'medical-orders' AND auth.role() = 'authenticated');