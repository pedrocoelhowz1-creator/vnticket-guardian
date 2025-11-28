/**
 * Função centralizada para verificar se um usuário é admin
 */
import { supabase } from '@/integrations/supabase/client';

export async function checkIsAdmin(userId: string, userEmail: string): Promise<boolean> {
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  
  if (roleError) {
    return false;
  }
  
  return !!roleData;
}

