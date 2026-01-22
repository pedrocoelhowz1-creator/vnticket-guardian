-- Criar tabela de ingressos manuais para vendas via WhatsApp/presencial
CREATE TABLE public.manual_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_cpf TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  sale_type TEXT NOT NULL DEFAULT 'online',
  sale_origin TEXT NOT NULL DEFAULT 'site',
  qr_generated BOOLEAN NOT NULL DEFAULT true,
  qr_payload TEXT,
  status TEXT NOT NULL DEFAULT 'valid',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.manual_tickets ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Authenticated users can view manual tickets" 
ON public.manual_tickets 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert manual tickets" 
ON public.manual_tickets 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update their tickets" 
ON public.manual_tickets 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Create indexes for better performance
CREATE INDEX idx_manual_tickets_event_id ON public.manual_tickets(event_id);
CREATE INDEX idx_manual_tickets_buyer_cpf ON public.manual_tickets(buyer_cpf);
CREATE INDEX idx_manual_tickets_created_by ON public.manual_tickets(created_by);
CREATE INDEX idx_manual_tickets_status ON public.manual_tickets(status);

-- Add comment for documentation
COMMENT ON TABLE public.manual_tickets IS 'Ingressos criados manualmente para vendas via WhatsApp ou presencial';