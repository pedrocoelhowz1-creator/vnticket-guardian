import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logo from "@/assets/logo.png";

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

      const { checkIsAdmin } = await import('@/lib/adminCheck');
      const isAdmin = await checkIsAdmin(
        currentSession.user.id,
        currentSession.user.email || ''
      );

      if (!isAdmin) {
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
      <div className="min-h-screen flex items-center justify-center bg-background circuit-bg">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4">
            <img src={logo} alt="VN TICKET" className="w-full h-full object-contain animate-float" />
          </div>
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground text-sm">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background circuit-bg pb-20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/dashboard")}
            className="hover:bg-secondary/50"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <img src={logo} alt="VN TICKET" className="w-8 h-8 object-contain" />
            <h1 className="text-lg font-bold">Histórico</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 animate-fade-in">
        {checkins.length === 0 ? (
          <Card className="stats-card neon-border">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma validação realizada ainda</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {checkins.map((checkin, index) => (
              <Card 
                key={checkin.id} 
                className={`stats-card card-hover animate-fade-in ${
                  checkin.status === 'valid' 
                    ? 'border-l-2 border-l-success' 
                    : 'border-l-2 border-l-destructive'
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {checkin.status === 'valid' ? (
                        <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-success" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </div>
                      )}
                      <span className={`font-medium ${
                        checkin.status === 'valid' ? 'text-success' : 'text-destructive'
                      }`}>
                        {checkin.status === 'valid' ? 'Válido' : 'Inválido'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-normal">
                      {format(new Date(checkin.validated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1">
                  <p className="text-sm truncate">
                    <span className="text-muted-foreground">Email:</span> {checkin.buyer_email}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    ID: {checkin.id_compra}
                  </p>
                  {checkin.reason && (
                    <p className="text-xs text-destructive pt-1">
                      <span className="font-medium">Motivo:</span> {checkin.reason}
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
