-- Check the current table structure and constraints
SELECT 
  conname, 
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'presentation_documents'::regclass;