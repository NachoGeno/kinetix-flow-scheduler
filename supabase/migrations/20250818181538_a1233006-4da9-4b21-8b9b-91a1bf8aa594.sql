-- Add document status field to medical orders
ALTER TABLE public.medical_orders 
ADD COLUMN document_status text NOT NULL DEFAULT 'pendiente';

-- Add check constraint for valid document status values
ALTER TABLE public.medical_orders 
ADD CONSTRAINT medical_orders_document_status_check 
CHECK (document_status IN ('pendiente', 'completa'));

-- Add index for filtering by document status
CREATE INDEX idx_medical_orders_document_status ON public.medical_orders(document_status);

-- Update existing orders with documents to 'completa' status
UPDATE public.medical_orders 
SET document_status = 'completa' 
WHERE attachment_url IS NOT NULL;

-- Add function to auto-update document status when file is uploaded
CREATE OR REPLACE FUNCTION public.update_medical_order_document_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    -- If attachment_url is being added, mark as complete
    IF NEW.attachment_url IS NOT NULL AND (OLD.attachment_url IS NULL OR OLD.attachment_url = '') THEN
        NEW.document_status = 'completa';
    -- If attachment_url is being removed, mark as pending
    ELSIF NEW.attachment_url IS NULL AND OLD.attachment_url IS NOT NULL THEN
        NEW.document_status = 'pendiente';
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create trigger to automatically update document status
CREATE TRIGGER update_medical_order_document_status_trigger
    BEFORE UPDATE ON public.medical_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_medical_order_document_status();