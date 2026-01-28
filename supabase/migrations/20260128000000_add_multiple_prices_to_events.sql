-- Add support for multiple prices/tickets per event
ALTER TABLE public.events ADD COLUMN prices JSONB DEFAULT '[]'::jsonb;

-- Create index for JSON queries
CREATE INDEX idx_events_prices ON public.events USING GIN(prices);

-- Add comment for documentation
COMMENT ON COLUMN public.events.prices IS 'Array of price/ticket types. Format: [{"name": "Pista", "price": 30}, {"name": "Camarote", "price": 60}]';
