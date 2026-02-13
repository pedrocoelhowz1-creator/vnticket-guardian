-- Prevent duplicate valid check-ins for the same ticket
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_unique_valid_id_compra
  ON public.checkins (id_compra)
  WHERE status = 'valid';

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_unique_valid_id_ingresso
  ON public.checkins (id_ingresso)
  WHERE status = 'valid';
