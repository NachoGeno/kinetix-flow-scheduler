-- =====================================================
-- FASE 1: MIGRACIONES PARA MÓDULO DE FACTURACIÓN
-- =====================================================

-- 1. Agregar nuevas columnas a billing_invoices
ALTER TABLE billing_invoices 
ADD COLUMN IF NOT EXISTS package_status TEXT DEFAULT 'preparing' CHECK (package_status IN ('preparing', 'ready', 'sent')),
ADD COLUMN IF NOT EXISTS package_url TEXT,
ADD COLUMN IF NOT EXISTS package_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS regeneration_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_regenerated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_regenerated_by UUID REFERENCES profiles(id);

-- 2. Crear tabla billing_package_documents
CREATE TABLE IF NOT EXISTS billing_package_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  medical_order_id UUID NOT NULL REFERENCES medical_orders(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  order_date DATE NOT NULL,
  consolidated_pdf_url TEXT NOT NULL,
  consolidated_pdf_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear índice para mejor performance
CREATE INDEX IF NOT EXISTS idx_billing_package_docs_invoice 
ON billing_package_documents(billing_invoice_id);

-- 4. Crear bucket de storage para paquetes de facturación
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('billing-packages', 'billing-packages', false, 52428800, ARRAY['application/pdf', 'application/zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;

-- 5. RLS Policies para billing_package_documents
ALTER TABLE billing_package_documents ENABLE ROW LEVEL SECURITY;

-- Admins y reception pueden gestionar todo
CREATE POLICY "Admins can manage all billing package documents"
ON billing_package_documents
FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Reception can manage billing package documents"
ON billing_package_documents
FOR ALL
TO authenticated
USING (can_manage_plus_payments());

-- 6. RLS Policies para storage bucket billing-packages
-- Admins y reception pueden subir archivos
CREATE POLICY "Admins can upload to billing-packages"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'billing-packages' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Reception can upload to billing-packages"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'billing-packages' 
  AND can_manage_plus_payments()
);

-- Admins y reception pueden leer archivos
CREATE POLICY "Admins can read from billing-packages"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'billing-packages' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Reception can read from billing-packages"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'billing-packages' 
  AND can_manage_plus_payments()
);

-- Admins y reception pueden actualizar archivos
CREATE POLICY "Admins can update billing-packages"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'billing-packages' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Reception can update billing-packages"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'billing-packages' 
  AND can_manage_plus_payments()
);

-- Admins pueden eliminar archivos
CREATE POLICY "Admins can delete from billing-packages"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'billing-packages' 
  AND is_admin(auth.uid())
);