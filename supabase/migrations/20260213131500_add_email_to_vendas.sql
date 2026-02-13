-- Add legacy email column required by existing constraints
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS email TEXT;
