-- Add legacy comprador columns required by existing constraints
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS nome_comprador TEXT,
  ADD COLUMN IF NOT EXISTS telefone_comprador TEXT,
  ADD COLUMN IF NOT EXISTS cpf_comprador TEXT,
  ADD COLUMN IF NOT EXISTS email_comprador TEXT;
