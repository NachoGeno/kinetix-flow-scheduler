-- Add storage bucket for medical order files
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-orders', 'medical-orders', false);

-- Add columns to medical_orders table for ART/obra social and file attachments
ALTER TABLE public.medical_orders 
ADD COLUMN art_provider TEXT,
ADD COLUMN art_authorization_number TEXT,
ADD COLUMN attachment_url TEXT,
ADD COLUMN attachment_name TEXT;

-- Create storage policies for medical order files
CREATE POLICY "Medical order files are viewable by authorized users"
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'medical-orders' AND (
    -- Users can view their own patient files
    EXISTS (
      SELECT 1 FROM medical_orders mo
      JOIN patients p ON p.id = mo.patient_id
      JOIN profiles pr ON pr.id = p.profile_id
      WHERE pr.user_id = auth.uid() 
      AND name LIKE mo.id::text || '/%'
    )
    -- Doctors can view files from orders they created
    OR EXISTS (
      SELECT 1 FROM medical_orders mo
      JOIN doctors d ON d.id = mo.doctor_id
      JOIN profiles pr ON pr.id = d.profile_id
      WHERE pr.user_id = auth.uid() 
      AND name LIKE mo.id::text || '/%'
    )
    -- Admins can view all files
    OR is_admin(auth.uid())
  )
);

CREATE POLICY "Medical order files can be uploaded by authorized users"
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'medical-orders' AND (
    -- Doctors can upload files for orders they create
    get_user_role(auth.uid()) = 'doctor'
    -- Admins can upload files
    OR is_admin(auth.uid())
  )
);

CREATE POLICY "Medical order files can be updated by authorized users"
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'medical-orders' AND (
    -- Doctors can update files for orders they created
    EXISTS (
      SELECT 1 FROM medical_orders mo
      JOIN doctors d ON d.id = mo.doctor_id
      JOIN profiles pr ON pr.id = d.profile_id
      WHERE pr.user_id = auth.uid() 
      AND name LIKE mo.id::text || '/%'
    )
    -- Admins can update all files
    OR is_admin(auth.uid())
  )
);

CREATE POLICY "Medical order files can be deleted by authorized users"
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'medical-orders' AND (
    -- Doctors can delete files for orders they created
    EXISTS (
      SELECT 1 FROM medical_orders mo
      JOIN doctors d ON d.id = mo.doctor_id
      JOIN profiles pr ON pr.id = d.profile_id
      WHERE pr.user_id = auth.uid() 
      AND name LIKE mo.id::text || '/%'
    )
    -- Admins can delete all files
    OR is_admin(auth.uid())
  )
);