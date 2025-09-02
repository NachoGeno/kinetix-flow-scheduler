-- Add enviado_a_os field to medical_orders
ALTER TABLE public.medical_orders 
ADD COLUMN enviado_a_os BOOLEAN DEFAULT FALSE;

-- Create billing_invoices table
CREATE TABLE public.billing_invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    obra_social_art_id UUID NOT NULL,
    invoice_number TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_presentations INTEGER NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) DEFAULT 0,
    file_url TEXT,
    file_name TEXT,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'sent'
);

-- Create billing_invoice_items table
CREATE TABLE public.billing_invoice_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    billing_invoice_id UUID NOT NULL,
    medical_order_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(billing_invoice_id, medical_order_id)
);

-- Create billing_export_templates table
CREATE TABLE public.billing_export_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    obra_social_art_id UUID NOT NULL UNIQUE,
    template_name TEXT NOT NULL,
    column_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_export_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_invoices
CREATE POLICY "Admins can manage all billing invoices" 
ON public.billing_invoices 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Reception can manage billing invoices" 
ON public.billing_invoices 
FOR ALL 
USING (can_manage_plus_payments());

-- RLS Policies for billing_invoice_items
CREATE POLICY "Admins can manage all billing invoice items" 
ON public.billing_invoice_items 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Reception can manage billing invoice items" 
ON public.billing_invoice_items 
FOR ALL 
USING (can_manage_plus_payments());

-- RLS Policies for billing_export_templates
CREATE POLICY "Admins can manage export templates" 
ON public.billing_export_templates 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Reception can view export templates" 
ON public.billing_export_templates 
FOR SELECT 
USING (can_manage_plus_payments());

-- Add triggers for updated_at
CREATE TRIGGER update_billing_invoices_updated_at
    BEFORE UPDATE ON public.billing_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_export_templates_updated_at
    BEFORE UPDATE ON public.billing_export_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();