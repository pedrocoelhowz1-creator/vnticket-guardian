-- Adicionar colunas de taxa à tabela events
ALTER TABLE public.events ADD COLUMN has_fee BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN fee_amount DECIMAL(10,2) DEFAULT 0.00;

-- Criar índices para melhor performance
CREATE INDEX idx_events_has_fee ON public.events(has_fee);
CREATE INDEX idx_events_fee_amount ON public.events(fee_amount);

-- Atualizar RLS policies se necessário (já existem policies para events)
-- As policies existentes já cobrem SELECT, INSERT, UPDATE, DELETE para admins e producers
