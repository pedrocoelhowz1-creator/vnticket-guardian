/**
 * Funções centralizadas para verificar papéis de usuário
 */
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'moderator' | 'producer';

export async function checkRole(userId: string, role: UserRole): Promise<boolean> {
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle();

  console.log(`checkRole (${role}):`, { userId, roleData, roleError });

  if (roleError) {
    console.error(`Erro ao verificar papel ${role}:`, roleError);
    return false;
  }

  const result = !!roleData;
  console.log(`Resultado checkRole (${role}):`, result);
  return result;
}

export async function checkIsAdmin(userId: string, userEmail: string): Promise<boolean> {
  return checkRole(userId, 'admin');
}

export async function checkIsProducer(userId: string): Promise<boolean> {
  return checkRole(userId, 'producer');
}

export async function checkIsAdminOrProducer(userId: string): Promise<boolean> {
  const [isAdmin, isProducer] = await Promise.all([
    checkIsAdmin(userId, ''),
    checkIsProducer(userId)
  ]);
  return isAdmin || isProducer;
}

