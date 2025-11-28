import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        if (!currentSession?.user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Verificar se o usuário tem role de admin
        // Lê diretamente da tabela user_roles
        console.log('useAdmin: Verificando admin para user:', currentSession.user.id);
        
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentSession.user.id)
          .eq('role', 'admin')
          .maybeSingle();

        console.log('useAdmin: Resultado:', { data, error, user_id: currentSession.user.id });

        if (error) {
          console.error('Error checking admin role:', error);
          console.error('Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          setIsAdmin(false);
        } else {
          console.log('useAdmin: isAdmin =', !!data);
          setIsAdmin(!!data);
        }
      } catch (error) {
        console.error('Error in useAdmin:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, loading, session };
}

