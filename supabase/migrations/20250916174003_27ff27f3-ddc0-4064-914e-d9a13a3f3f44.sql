-- Actualizar la función del trigger para incluir organization_id en las transacciones de efectivo
CREATE OR REPLACE FUNCTION public.create_income_transaction_from_plus_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile_id_var UUID;
BEGIN
  -- Only create transaction for cash payments
  IF NEW.payment_method = 'cash' THEN
    -- Get the profile_id from the user_id
    SELECT id INTO profile_id_var
    FROM profiles
    WHERE user_id = NEW.collected_by;
    
    -- If no profile found, skip creating the transaction
    IF profile_id_var IS NULL THEN
      RAISE WARNING 'No profile found for user_id: %', NEW.collected_by;
      RETURN NEW;
    END IF;
    
    INSERT INTO public.cash_transactions (
      transaction_type,
      amount,
      description,
      transaction_date,
      plus_payment_id,
      patient_id,
      medical_order_id,
      created_by,
      organization_id
    )
    VALUES (
      'income',
      NEW.amount,
      'Ingreso por Plus Payment - ' || COALESCE((
        SELECT CONCAT(pr.first_name, ' ', pr.last_name)
        FROM patients p
        JOIN profiles pr ON p.profile_id = pr.id
        WHERE p.id = NEW.patient_id
      ), 'Paciente'),
      NEW.payment_date,
      NEW.id,
      NEW.patient_id,
      NEW.medical_order_id,
      profile_id_var,
      NEW.organization_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;