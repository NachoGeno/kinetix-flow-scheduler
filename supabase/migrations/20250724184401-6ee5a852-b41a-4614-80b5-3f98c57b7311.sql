-- Crear enum para métodos de pago
CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'mercado_pago');

-- Crear tabla para plus payments
CREATE TABLE public.plus_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL,
    medical_order_id UUID NOT NULL,
    professional_id UUID,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_method payment_method NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    collected_by UUID NOT NULL,
    observations TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.plus_payments ENABLE ROW LEVEL SECURITY;

-- Crear políticas de RLS
CREATE POLICY "Admins can manage all plus payments" 
ON public.plus_payments 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Reception can manage plus payments" 
ON public.plus_payments 
FOR ALL 
USING (get_user_role(auth.uid()) IN ('admin', 'reception'));

CREATE POLICY "Doctors can view their plus payments" 
ON public.plus_payments 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM doctors d 
    JOIN profiles p ON d.profile_id = p.id 
    WHERE d.id = plus_payments.professional_id AND p.user_id = auth.uid()
));

CREATE POLICY "Patients can view their plus payments" 
ON public.plus_payments 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM patients pt 
    JOIN profiles pr ON pt.profile_id = pr.id 
    WHERE pt.id = plus_payments.patient_id AND pr.user_id = auth.uid()
));

-- Trigger para updated_at
CREATE TRIGGER update_plus_payments_updated_at
BEFORE UPDATE ON public.plus_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Crear tabla para control de caja diario (opcional)
CREATE TABLE public.daily_cash_control (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    control_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_cash_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    actual_cash_amount NUMERIC(10,2),
    difference NUMERIC(10,2) GENERATED ALWAYS AS (actual_cash_amount - expected_cash_amount) STORED,
    closed_by UUID NOT NULL,
    observations TEXT,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(control_date)
);

-- Habilitar RLS para control de caja
ALTER TABLE public.daily_cash_control ENABLE ROW LEVEL SECURITY;

-- Políticas para control de caja
CREATE POLICY "Admins and reception can manage cash control" 
ON public.daily_cash_control 
FOR ALL 
USING (get_user_role(auth.uid()) IN ('admin', 'reception'));

-- Trigger para updated_at en cash control
CREATE TRIGGER update_daily_cash_control_updated_at
BEFORE UPDATE ON public.daily_cash_control
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función para obtener estadísticas diarias de plus
CREATE OR REPLACE FUNCTION public.get_daily_plus_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    total_amount NUMERIC,
    cash_amount NUMERIC,
    transfer_amount NUMERIC,
    mercado_pago_amount NUMERIC,
    total_payments BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN amount ELSE 0 END), 0) as transfer_amount,
        COALESCE(SUM(CASE WHEN payment_method = 'mercado_pago' THEN amount ELSE 0 END), 0) as mercado_pago_amount,
        COUNT(*) as total_payments
    FROM plus_payments 
    WHERE payment_date = target_date;
$$;

-- Función para obtener reporte por período
CREATE OR REPLACE FUNCTION public.get_plus_payments_report(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    professional_filter UUID DEFAULT NULL,
    payment_method_filter payment_method DEFAULT NULL
)
RETURNS TABLE(
    payment_id UUID,
    patient_name TEXT,
    professional_name TEXT,
    obra_social_name TEXT,
    amount NUMERIC,
    payment_method payment_method,
    payment_date DATE,
    observations TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT 
        pp.id as payment_id,
        CONCAT(pt_profile.first_name, ' ', pt_profile.last_name) as patient_name,
        CASE 
            WHEN pp.professional_id IS NOT NULL 
            THEN CONCAT(prof_profile.first_name, ' ', prof_profile.last_name)
            ELSE 'Sin asignar'
        END as professional_name,
        osa.nombre as obra_social_name,
        pp.amount,
        pp.payment_method,
        pp.payment_date,
        pp.observations
    FROM plus_payments pp
    JOIN patients pt ON pp.patient_id = pt.id
    JOIN profiles pt_profile ON pt.profile_id = pt_profile.id
    LEFT JOIN obras_sociales_art osa ON pt.obra_social_art_id = osa.id
    LEFT JOIN doctors d ON pp.professional_id = d.id
    LEFT JOIN profiles prof_profile ON d.profile_id = prof_profile.id
    WHERE 
        (start_date IS NULL OR pp.payment_date >= start_date)
        AND (end_date IS NULL OR pp.payment_date <= end_date)
        AND (professional_filter IS NULL OR pp.professional_id = professional_filter)
        AND (payment_method_filter IS NULL OR pp.payment_method = payment_method_filter)
    ORDER BY pp.payment_date DESC, pp.created_at DESC;
$$;