-- Allow manual tickets without referenced ingresso record
ALTER TABLE public.vendas
  DROP CONSTRAINT IF EXISTS vendas_id_ingresso_fkey;
