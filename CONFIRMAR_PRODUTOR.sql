-- CONFIRMAR EMAIL E DAR PERMISSÕES DE PRODUTOR
-- Execute este script no SQL Editor do Supabase

-- 1. Confirmar email do usuário produtor01@vnticket.com
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'produtor01@vnticket.com'
AND email_confirmed_at IS NULL;

-- 2. Atribuir papel de producer (versão simplificada)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'producer'
FROM auth.users
WHERE email = 'produtor01@vnticket.com'
AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.users.id AND role = 'producer'
);

-- 3. Verificar se tudo funcionou
SELECT
    CASE WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Email confirmado!'
         ELSE '❌ Email não confirmado' END as status_email,
    CASE WHEN ur.role = 'producer' THEN '✅ Papel producer atribuído!'
         ELSE '❌ Papel não atribuído' END as status_role,
    u.id,
    u.email,
    u.email_confirmed_at as email_confirmado_em,
    ur.role,
    u.created_at as criado_em
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id AND ur.role = 'producer'
WHERE u.email = 'produtor01@vnticket.com';
