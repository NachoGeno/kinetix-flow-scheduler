-- FASE 4: Limpiar factura 33333 de prueba (CORREGIDO)

-- 1. Cancelar la factura (usar 'preparing' en lugar de 'error' para package_status)
UPDATE billing_invoices 
SET 
  status = 'cancelled', 
  package_status = 'preparing',
  package_url = NULL,
  package_generated_at = NULL
WHERE invoice_number = '33333';

-- 2. Revertir el estado de las órdenes médicas asociadas
UPDATE medical_orders 
SET enviado_a_os = false
WHERE id IN (
  SELECT medical_order_id 
  FROM billing_invoice_items 
  WHERE billing_invoice_id IN (
    SELECT id FROM billing_invoices WHERE invoice_number = '33333'
  )
);