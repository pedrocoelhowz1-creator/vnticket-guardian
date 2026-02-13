-- Ensure vendas stores buyer email for manual tickets
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS buyer_email TEXT;
