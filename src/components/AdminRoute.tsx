import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { useToast } from '@/hooks/use-toast';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAdmin, loading, session } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        // Não está autenticado
        navigate('/auth');
        toast({
          title: "Acesso negado",
          description: "Você precisa fazer login para acessar esta página",
          variant: "destructive",
        });
      } else if (!isAdmin) {
        // Está autenticado mas não é admin
        navigate('/auth');
        toast({
          title: "Acesso negado",
          description: "Apenas administradores podem acessar este sistema",
          variant: "destructive",
        });
      }
    }
  }, [isAdmin, loading, session, navigate, toast]);

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

  if (!session || !isAdmin) {
    return null; // Redirecionamento em andamento
  }

  return <>{children}</>;
}

