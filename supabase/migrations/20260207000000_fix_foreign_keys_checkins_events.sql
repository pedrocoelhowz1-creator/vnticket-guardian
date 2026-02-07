-- Add foreign key relationship between checkins and events if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_checkins_events_id'
  ) THEN
    ALTER TABLE public.checkins
    ADD CONSTRAINT fk_checkins_events_id
    FOREIGN KEY (id_evento) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key relationship between manual_tickets and events if table exists and FK doesn't exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manual_tickets') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_manual_tickets_events_id'
    ) THEN
      ALTER TABLE public.manual_tickets
      ADD CONSTRAINT fk_manual_tickets_events_id
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;
