-- Add foreign key relationship between checkins and events if it doesn't exist
ALTER TABLE public.checkins
ADD CONSTRAINT fk_checkins_events_id
FOREIGN KEY (id_evento) REFERENCES public.events(id) ON DELETE CASCADE;

-- Add foreign key relationship between manual_tickets and events if it doesn't exist
ALTER TABLE public.manual_tickets
ADD CONSTRAINT fk_manual_tickets_events_id
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
