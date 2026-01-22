-- Create RPC function to insert manual tickets (bypasses schema cache issues)
CREATE OR REPLACE FUNCTION public.insert_manual_ticket(
  p_id UUID,
  p_event_id UUID,
  p_buyer_name TEXT,
  p_buyer_cpf TEXT,
  p_buyer_phone TEXT,
  p_payment_method TEXT,
  p_sale_type TEXT,
  p_sale_origin TEXT,
  p_qr_generated BOOLEAN,
  p_qr_payload TEXT,
  p_status TEXT,
  p_price DECIMAL,
  p_created_by UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.manual_tickets (
    id, event_id, buyer_name, buyer_cpf, buyer_phone,
    payment_method, sale_type, sale_origin, qr_generated,
    qr_payload, status, price, created_by
  ) VALUES (
    p_id, p_event_id, p_buyer_name, p_buyer_cpf, p_buyer_phone,
    p_payment_method, p_sale_type, p_sale_origin, p_qr_generated,
    p_qr_payload, p_status, p_price, p_created_by
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.insert_manual_ticket TO authenticated;