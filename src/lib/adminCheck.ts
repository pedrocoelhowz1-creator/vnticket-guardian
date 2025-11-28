/**
 * Função centralizada para verificar se um usuário é admin
 * Usa função RPC por email (mais confiável) com fallback para query direta
 */
import { supabase } from '@/integrations/supabase/client';

export async function checkIsAdmin(userId: string, userEmail: string): Promise<boolean> {
  try {
    // Método 1: Tentar usar função RPC (busca por email - mais confiável)
    try {
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('check_admin_by_email', { user_email: userEmail });
      
      // Se a RPC funcionou, usar o resultado
      if (!rpcError && rpcResult !== null && rpcResult !== undefined) {
        return rpcResult === true;
      }
      
      // Se erro 404 ou função não existe, continuar para fallback
      if (rpcError) {
        const isFunctionNotFound = rpcError.code === 'PGRST116' || 
                                  rpcError.code === 'PGRST202' ||
                                  rpcError.message?.includes('404') || 
                                  rpcError.message?.includes('not found') ||
                                  rpcError.message?.includes('Could not find the function');
        
        if (isFunctionNotFound) {
          console.log('Função RPC não encontrada, usando fallback...');
        } else {
          console.warn('Erro na RPC:', rpcError);
          // Se não for função não encontrada, ainda tentar fallback
        }
      }
    } catch (rpcException) {
      // Se der exception (como 404), continuar para fallback
      console.log('Exception na RPC, usando fallback...', rpcException);
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

