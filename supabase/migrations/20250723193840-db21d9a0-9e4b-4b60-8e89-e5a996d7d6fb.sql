-- Primero verificar si el bucket existe y eliminarlo si está mal configurado
DELETE FROM storage.buckets WHERE id = 'medical-orders';

-- Crear el bucket medical-orders con configuración correcta
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-orders', 'medical-orders', true);

-- Crear políticas de almacenamiento más permisivas para medical-orders
CREATE POLICY "Allow authenticated users to view medical order files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'medical-orders' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to upload medical order files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'medical-orders' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update medical order files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'medical-orders' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete medical order files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'medical-orders' AND auth.role() = 'authenticated');