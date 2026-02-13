-- Ensure events can store ticket types (pista, VIP, etc)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_types JSONB DEFAULT '[]'::jsonb;
