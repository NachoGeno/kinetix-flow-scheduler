-- Check current constraints on document_type column
SELECT 
  conname, 
  pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint 
WHERE conrelid = 'presentation_documents'::regclass 
  AND conname LIKE '%document_type%';

-- Also check if there's a CHECK constraint on the table
\d+ presentation_documents;