import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, CheckCircle, XCircle, QrCode, DollarSign, Users, Calendar } from "lucide-react";
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
    const checkAdmin = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (!currentSession?.user) {
        navigate("/auth");
        return;
      }

      const { checkIsAdminOrProducer } = await import('@/lib/adminCheck');
      const hasAccess = await checkIsAdminOrProducer(currentSession.user.id);

      if (!hasAccess) {
        toast({ title: "Acesso negado", variant: "destructive" });
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      loadStats();
    };

    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const loadStats = async () => {
    try {
      const { data: checkins } = await supabase.from('checkins').select('*');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCheckins = checkins?.filter(c => new Date(c.validated_at) >= today) || [];

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gradient-primary">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema de ingressos</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Validações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="kpi-value">{stats.total}</span>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Ingressos Válidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-success">{stats.valid}</span>
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Ingressos Inválidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-destructive">{stats.invalid}</span>
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{stats.today}</span>
                <QrCode className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
