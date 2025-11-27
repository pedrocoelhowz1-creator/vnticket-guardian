import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Checkin {
  id: string;
  id_compra: string;
  buyer_email: string;
  validated_at: string;
  status: string;
  reason: string | null;
}

const History = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (!currentSession?.user) {
        navigate("/auth");
        return;
      }

      // Verificar se é admin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentSession.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError || !roleData) {
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      loadCheckins();
    };

    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        checkAdmin();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadCheckins = async () => {
    try {
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .order('validated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCheckins(data || []);
    } catch (error) {
      console.error('Error loading checkins:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card shadow-soft sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Histórico de Validações</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {checkins.length === 0 ? (
          <Card className="shadow-medium">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma validação realizada ainda</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {checkins.map((checkin) => (
              <Card 
                key={checkin.id} 
                className={`shadow-soft ${
                  checkin.status === 'valid' 
                    ? 'border-l-4 border-l-success' 
                    : 'border-l-4 border-l-destructive'
                }`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center space-x-2">
                      {checkin.status === 'valid' ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <span className="font-medium">
                        {checkin.status === 'valid' ? 'Válido' : 'Inválido'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-normal">
                      {format(new Date(checkin.validated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>
                    <strong>Email:</strong> {checkin.buyer_email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>ID Compra:</strong> {checkin.id_compra}
                  </p>
                  {checkin.reason && (
                    <p className="text-xs text-destructive pt-2">
                      <strong>Motivo:</strong> {checkin.reason}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default History;
