/**
 * Função centralizada para verificar se um usuário é admin
 * Usa função RPC por email (mais confiável) com fallback para query direta
 */
import { supabase } from '@/integrations/supabase/client';

export async function checkIsAdmin(userId: string, userEmail: string): Promise<boolean> {
  try {
    // Método 1: Tentar usar função RPC (busca por email - mais confiável)
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('check_admin_by_email', { user_email: userEmail });
    
    if (!rpcError && rpcResult !== null && rpcResult !== undefined) {
      return rpcResult === true;
    }
    
    // Método 2: Fallback - buscar diretamente pelo user_id
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (roleError) {
      console.error('Error checking admin (fallback):', roleError);
      return false;
    }
    
    return !!roleData;
  } catch (error) {
    console.error('Error in checkIsAdmin:', error);
    return false;
  }
}

