import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import { checkIsAdmin } from '@/lib/adminCheck';

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

        // Verificar se o usuário tem role de admin usando função centralizada
        const adminStatus = await checkIsAdmin(
          currentSession.user.id,
          currentSession.user.email || ''
        );
        setIsAdmin(adminStatus);
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

