-- Add shared_file_id field to presentation_documents table to support combined documents
ALTER TABLE public.presentation_documents 
ADD COLUMN shared_file_id UUID;

-- Create index for better performance when querying shared documents
CREATE INDEX idx_presentation_documents_shared_file_id 
ON public.presentation_documents(shared_file_id) 
WHERE shared_file_id IS NOT NULL;