import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QrCode, LogOut, History, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

interface CheckinStats {
  total: number;
  valid: number;
  invalid: number;
  today: number;
}

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [stats, setStats] = useState<CheckinStats>({ total: 0, valid: 0, invalid: 0, today: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        loadStats();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadStats = async () => {
    try {
      const { data: checkins, error } = await supabase
        .from('checkins')
        .select('*');

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayCheckins = checkins?.filter(c => 
        new Date(c.validated_at) >= today
      ) || [];

      setStats({
        total: checkins?.length || 0,
        valid: checkins?.filter(c => c.status === 'valid').length || 0,
        invalid: checkins?.filter(c => c.status === 'invalid').length || 0,
        today: todayCheckins.length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            VN TICKET Admin
          </h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Validações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{stats.total}</div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ingressos Válidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-success">{stats.valid}</div>
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ingressos Inválidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-destructive">{stats.invalid}</div>
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Validações Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{stats.today}</div>
                <QrCode className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-medium hover:shadow-strong transition-shadow cursor-pointer" onClick={() => navigate("/scanner")}>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <QrCode className="h-6 w-6 text-primary" />
                <CardTitle>Validar Ingresso</CardTitle>
              </div>
              <CardDescription>
                Escaneie QR codes para validar ingressos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg">
                Abrir Scanner
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-medium hover:shadow-strong transition-shadow cursor-pointer" onClick={() => navigate("/history")}>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <History className="h-6 w-6 text-accent" />
                <CardTitle>Histórico</CardTitle>
              </div>
              <CardDescription>
                Visualize todas as validações realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" size="lg">
                Ver Histórico
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;