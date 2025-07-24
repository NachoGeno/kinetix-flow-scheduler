-- Hacer el bucket medical-orders público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'medical-orders';