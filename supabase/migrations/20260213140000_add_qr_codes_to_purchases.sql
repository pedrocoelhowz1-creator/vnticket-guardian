-- Store QR codes for purchases (one per ticket)
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS qr_codes JSONB DEFAULT '[]'::jsonb;
