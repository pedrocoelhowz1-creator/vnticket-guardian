import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        if (!currentSession?.user) {
          setHasAccess(false);
          setLoading(false);
          return;
        }

        const { checkIsAdminOrProducer } = await import('@/lib/adminCheck');
        const access = await checkIsAdminOrProducer(currentSession.user.id);
        setHasAccess(access);
      } catch (error) {
        console.error('Error in AdminRoute:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAccess();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  useEffect(() => {
    if (!loading) {
      if (!session) {
        navigate('/auth');
        toast({
          title: "Acesso negado",
          description: "Você precisa fazer login para acessar esta página",
          variant: "destructive",
        });
      } else if (!hasAccess) {
        navigate('/auth');
        toast({
          title: "Acesso negado",
          description: "Apenas administradores e produtores podem acessar este sistema",
          variant: "destructive",
        });
      }
    }
  }, [hasAccess, loading, session, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!session || !hasAccess) {
    return null;
  }

  return <>{children}</>;
}
