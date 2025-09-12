-- Corregir la función check_presentation_ready para usar solo columnas existentes
CREATE OR REPLACE FUNCTION public.check_presentation_ready(order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    order_record RECORD;
    sessions_completed BOOLEAN := false;
BEGIN
    -- Obtener información de la orden médica
    SELECT 
        total_sessions,
        sessions_used,
        completed
    INTO order_record
    FROM medical_orders 
    WHERE id = order_id;
    
    -- Si no se encuentra la orden, retornar false
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Verificar si las sesiones están completas
    -- Una orden está lista si:
    -- 1. Está marcada como completada, O
    -- 2. El número de sesiones utilizadas es igual o mayor al total de sesiones
    sessions_completed := order_record.completed = true OR 
                         order_record.sessions_used >= order_record.total_sessions;
    
    RETURN sessions_completed;
END;
$function$