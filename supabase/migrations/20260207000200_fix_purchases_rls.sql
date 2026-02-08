-- Desabilitar RLS na tabela purchases para admin ver todas as vendas
ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;

-- Reabilitar com política permissiva para admins
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes (se já criadas)
DROP POLICY IF EXISTS "Admin can view all purchases" ON public.purchases;
DROP POLICY IF EXISTS "Anyone can insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "Owner can update purchases" ON public.purchases;

-- Política para admin master ver TODAS as compras
CREATE POLICY "Admin can view all purchases"
  ON public.purchases FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    user_id = auth.uid()
  );

-- Política para inserir compras
CREATE POLICY "Anyone can insert purchases"
  ON public.purchases FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para atualizar compras
CREATE POLICY "Owner can update purchases"
  ON public.purchases FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
