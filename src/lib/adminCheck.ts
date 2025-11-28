/**
 * Função centralizada para verificar se um usuário é admin
 * Versão simplificada que funciona diretamente com a tabela user_roles
 */
import { supabase } from '@/integrations/supabase/client';

export async function checkIsAdmin(userId: string, userEmail: string): Promise<boolean> {
  try {
    // Buscar diretamente na tabela user_roles
    // A política RLS "Users can view their own role" permite que usuários leiam seus próprios registros
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (roleError) {
      console.error('Erro ao verificar admin:', roleError);
      return false;
    }
    
    return !!roleData;
  } catch (error) {
    console.error('Error in checkIsAdmin:', error);
    return false;
  }
}

