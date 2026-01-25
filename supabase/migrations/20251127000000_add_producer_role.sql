-- Adicionar 'producer' ao enum app_role
ALTER TYPE public.app_role ADD VALUE 'producer';

-- Adicionar coluna producer_id à tabela events
ALTER TABLE public.events ADD COLUMN producer_id UUID REFERENCES auth.users(id);

-- Criar índice para melhor performance
CREATE INDEX idx_events_producer_id ON public.events(producer_id);

-- Atualizar RLS policies para permitir produtores verem seus próprios eventos
CREATE POLICY "Producers can view their own events"
  ON public.events FOR SELECT
  TO authenticated
  USING (producer_id = auth.uid());

CREATE POLICY "Producers can update their own events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (producer_id = auth.uid());

-- Criar usuário produtor
-- Nota: Este usuário será criado via Supabase Auth, mas aqui definimos o papel
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'producer'::app_role
FROM auth.users
WHERE email = 'produtor01@vnticket.com';
