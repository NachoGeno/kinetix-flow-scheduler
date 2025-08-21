-- Drop the existing constraint
ALTER TABLE presentation_documents DROP CONSTRAINT presentation_documents_document_type_check;

-- Add the new constraint that includes 'social_work_authorization'
ALTER TABLE presentation_documents ADD CONSTRAINT presentation_documents_document_type_check 
CHECK (document_type = ANY (ARRAY['medical_order'::text, 'clinical_evolution'::text, 'attendance_record'::text, 'social_work_authorization'::text]));