-- Create storage bucket for billing files
INSERT INTO storage.buckets (id, name, public) VALUES ('billing-files', 'billing-files', false);

-- Create RLS policies for billing files
CREATE POLICY "Admins can upload billing files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'billing-files' AND is_admin(auth.uid()));

CREATE POLICY "Admins can view billing files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'billing-files' AND is_admin(auth.uid()));

CREATE POLICY "Reception can view billing files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'billing-files' AND can_manage_plus_payments());

CREATE POLICY "Admins can delete billing files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'billing-files' AND is_admin(auth.uid()));