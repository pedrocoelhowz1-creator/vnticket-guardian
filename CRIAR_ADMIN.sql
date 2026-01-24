-- CRIAR USUÁRIO ADMINISTRADOR
-- Execute este script no SQL Editor do Supabase

-- 1. Criar usuário admin (substitua pelo email desejado)
-- IMPORTANTE: Primeiro crie o usuário através da interface do Supabase Auth ou signup

-- 2. Confirmar email do usuário admin
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'admin@vnticket.com'  -- Substitua pelo email do admin
AND email_confirmed_at IS NULL;

-- 3. Atribuir papel de admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin@vnticket.com'  -- Substitua pelo email do admin
AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.users.id AND role = 'admin'
);

-- 4. Verificar se tudo funcionou
SELECT
    CASE WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Email confirmado!'
         ELSE '❌ Email não confirmado' END as status_email,
    CASE WHEN ur.role = 'admin' THEN '✅ Papel admin atribuído!'
         ELSE '❌ Papel não atribuído' END as status_role,
    u.id,
    u.email,
    u.email_confirmed_at as email_confirmado_em,
    ur.role,
    u.created_at as criado_em
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id AND ur.role = 'admin'
WHERE u.email = 'admin@vnticket.com';  -- Substitua pelo email do admin
