-- Adicionar colunas de disponibilidade à tabela events
ALTER TABLE public.events ADD COLUMN is_available BOOLEAN DEFAULT true;
ALTER TABLE public.events ADD COLUMN unavailability_reason TEXT;

-- Criar índices para melhor performance
CREATE INDEX idx_events_is_available ON public.events(is_available);

-- Comentários para documentação
COMMENT ON COLUMN public.events.is_available IS 'Indica se o evento está disponível para compra (true) ou pausado/indisponível (false)';
COMMENT ON COLUMN public.events.unavailability_reason IS 'Motivo pela qual o evento está indisponível, ex: "Evento será prorrogado"';
