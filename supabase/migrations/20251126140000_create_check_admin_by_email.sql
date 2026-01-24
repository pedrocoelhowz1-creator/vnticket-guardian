-- Criar função RPC para verificar admin por email
-- Isso contorna o problema de IDs diferentes

CREATE OR REPLACE FUNCTION public.check_admin_by_email(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN auth.users au ON ur.user_id = au.id
    WHERE au.email = user_email
      AND ur.role = 'admin'
  )
$$;

