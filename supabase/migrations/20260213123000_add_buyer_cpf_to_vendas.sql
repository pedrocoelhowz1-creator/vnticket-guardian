-- Ensure vendas stores buyer CPF for manual tickets
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS buyer_cpf TEXT;
