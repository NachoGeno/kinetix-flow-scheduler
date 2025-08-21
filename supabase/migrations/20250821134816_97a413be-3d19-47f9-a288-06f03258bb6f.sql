-- Check current constraint on presentation_documents
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'presentation_documents'::regclass 
AND conname LIKE '%document_type%';

-- View the current enum type definition if it exists
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type_enum');