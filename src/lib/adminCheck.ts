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
                                  rpcError.message?.includes('Could not find the function') ||
                                  rpcError.message?.includes('schema cache');
        
        if (isFunctionNotFound) {
          console.log('Função RPC não encontrada (PGRST202), usando fallback...');
        } else {
          console.warn('Erro na RPC (outro tipo):', rpcError);
          // Mesmo assim, tentar fallback
        }
      }
    } catch (rpcException) {
      // Se der exception (como 404), continuar para fallback
      console.log('Exception na RPC, usando fallback...', rpcException);
    }
    
    // Método 2: Fallback - buscar diretamente pelo user_id
    console.log('=== FALLBACK ATIVADO ===');
    console.log('Buscando admin pelo user_id:', userId);
    console.log('Email do usuário:', userEmail);
    
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    
    console.log('=== RESULTADO DO FALLBACK ===');
    console.log('roleData:', roleData);
    console.log('roleError:', roleError);
    console.log('userId usado:', userId);
    
    if (roleError) {
      console.error('❌ ERRO no fallback:', roleError);
      console.error('Código do erro:', roleError.code);
      console.error('Mensagem:', roleError.message);
      return false;
    }
    
    if (!roleData) {
      console.warn('⚠️ Nenhum registro admin encontrado para user_id:', userId);
      console.warn('Verifique se o registro existe no banco de dados');
    }
    
    const isAdminResult = !!roleData;
    console.log('✅ Resultado final isAdmin:', isAdminResult);
    return isAdminResult;
  } catch (error) {
    console.error('Error in checkIsAdmin:', error);
    return false;
  }
}

