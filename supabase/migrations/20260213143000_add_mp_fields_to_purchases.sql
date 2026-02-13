-- Mercado Pago integration fields
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS mp_preference_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS ticket_type TEXT,
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
