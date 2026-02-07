import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  QrCode, LogOut, TrendingUp, CheckCircle, XCircle, Calendar, 
  Users, DollarSign, Ticket, ArrowUpRight, ArrowDownLeft,
  BarChart3, PieChart, Eye, Eye2, FileText
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";

interface SalesStats {
  totalEvents: number;
  totalSales: number;
  totalRevenue: number;
  totalTickets: number;
  validCheckins: number;
  invalidCheckins: number;
  todayRevenue: number;
  todaySales: number;
  events: any[];
}

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [stats, setStats] = useState<SalesStats>({
    totalEvents: 0,
    totalSales: 0,
    totalRevenue: 0,
    totalTickets: 0,
    validCheckins: 0,
    invalidCheckins: 0,
    todayRevenue: 0,
    todaySales: 0,
    events: []
  });
  const [isAdmin, setIsAdmin] = useState(false);
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

      // Verificar se é admin master
      const isAdminMaster = currentSession.user.email === 'pedrocoelhowz1@gmail.com';
      setIsAdmin(isAdminMaster);

      // Verificar se tem acesso ao sistema
      const { checkIsAdminOrProducer } = await import('@/lib/adminCheck');
      const hasAccess = await checkIsAdminOrProducer(currentSession.user.id);

      if (!hasAccess && !isAdminMaster) {
        toast({
          title: "Acesso negado",
          description: "Apenas administradores ou produtores podem acessar este sistema",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      loadStats(isAdminMaster, currentSession.user.id);
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
  }, [navigate, toast]);

  const loadStats = async (isAdminMaster: boolean, userId: string) => {
    try {
      // Buscar eventos
      let eventsQuery = supabase
        .from('events')
        .select('*');

      if (!isAdminMaster) {
        eventsQuery = eventsQuery.eq('producer_id', userId);
      }

      const { data: events, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;

      // Buscar checkins
      let checkinsQuery = supabase
        .from('checkins')
        .select('*, events!inner(id, price, producer_id, has_fee, fee_amount)');

      if (!isAdminMaster) {
        checkinsQuery = checkinsQuery.eq('events.producer_id', userId);
      }

      const { data: checkins, error: checkinsError } = await checkinsQuery;
      if (checkinsError) throw checkinsError;

      // Buscar vendas manuais
      let ticketsQuery = supabase
        .from('manual_tickets')
        .select('*, events!inner(id, price, producer_id, has_fee, fee_amount)');

      if (!isAdminMaster) {
        ticketsQuery = ticketsQuery.eq('events.producer_id', userId);
      }

      const { data: manualTickets, error: ticketsError } = await ticketsQuery;
      if (ticketsError) throw ticketsError;

      // Calcular estatísticas
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const validCheckins = checkins?.filter(c => c.status === 'valid').length || 0;
      const invalidCheckins = checkins?.filter(c => c.status === 'invalid').length || 0;
      
      const todayCheckins = checkins?.filter(c => 
        new Date(c.validated_at) >= today
      ) || [];

      const totalRevenue = (checkins || []).reduce((sum, c: any) => {
        const eventPrice = c.events?.price || 0;
        const fee = c.events?.has_fee ? (eventPrice * 0.10) : 0;
        return sum + eventPrice + fee;
      }, 0) + (manualTickets || []).reduce((sum, t: any) => sum + (t.price || 0), 0);

      const todayRevenue = todayCheckins.reduce((sum, c: any) => {
        const eventPrice = c.events?.price || 0;
        const fee = c.events?.has_fee ? (eventPrice * 0.10) : 0;
        return sum + eventPrice + fee;
      }, 0);

      const totalTickets = (checkins?.length || 0) + (manualTickets?.length || 0);
      const todaySales = todayCheckins.length + (manualTickets?.filter(t => {
        const t_date = new Date(t.created_at);
        t_date.setHours(0, 0, 0, 0);
        return t_date >= today;
      }).length || 0);

      setStats({
        totalEvents: events?.length || 0,
        totalSales: totalTickets,
        totalRevenue: totalRevenue,
        totalTickets: totalTickets,
        validCheckins: validCheckins,
        invalidCheckins: invalidCheckins,
        todayRevenue: todayRevenue,
        todaySales: todaySales,
        events: events || []
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as estatísticas",
        variant: "destructive"
      });
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/50 to-background">
        <div className="text-center">
          <img src={logo} alt="VN TICKET" className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando seu dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="VN TICKET" className="w-10 h-10" />
            <div>
              <h1 className="text-2xl font-bold gradient-text">VN TICKET</h1>
              <p className="text-xs text-muted-foreground">{isAdmin ? '👑 Admin Master' : 'Seu Dashboard'}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total de Receita */}
          <Card className="border-border/50 bg-gradient-to-br from-green-50/50 to-green-100/30 dark:from-green-950/30 dark:to-green-900/20 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Receita Total</CardTitle>
                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                R$ {stats.totalRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </div>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-2">
                {stats.totalSales} {stats.totalSales === 1 ? 'venda' : 'vendas'}
              </p>
            </CardContent>
          </Card>

          {/* Receita Hoje */}
          <Card className="border-border/50 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/30 dark:to-blue-900/20 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Hoje</CardTitle>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                  <ArrowUpRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                R$ {stats.todayRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </div>
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-2">
                {stats.todaySales} {stats.todaySales === 1 ? 'venda' : 'vendas'} hoje
              </p>
            </CardContent>
          </Card>

          {/* Total de Ingressos */}
          <Card className="border-border/50 bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/30 dark:to-purple-900/20 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">Ingressos</CardTitle>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <Ticket className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">
                {stats.totalTickets}
              </div>
              <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-2">
                <span className="text-green-600 dark:text-green-400">✓ {stats.validCheckins}</span> válidos
              </p>
            </CardContent>
          </Card>

          {/* Eventos */}
          <Card className="border-border/50 bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-950/30 dark:to-orange-900/20 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">Eventos</CardTitle>
                <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                  <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-700 dark:text-orange-400">
                {stats.totalEvents}
              </div>
              <p className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-2">
                Eventos cadastrados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-border/50 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:border-primary/50" onClick={() => navigate("/scanner")}>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Scanner de QR</CardTitle>
                  <CardDescription className="text-xs">Validar ingressos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="sm">
                Abrir Scanner
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:border-primary/50" onClick={() => navigate("/events")}>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Gerenciar Eventos</CardTitle>
                  <CardDescription className="text-xs">Criar e editar eventos</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="sm">
                Eventos
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:border-primary/50" onClick={() => navigate("/history")}>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Histórico</CardTitle>
                  <CardDescription className="text-xs">Validações realizadas</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" size="sm">
                Ver Histórico
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Eventos Recentes */}
        {stats.events.length > 0 && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Eventos Recentes
              </CardTitle>
              <CardDescription>Últimos eventos cadastrados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.events.slice(0, 5).map(event => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{event.title}</h4>
                      <p className="text-xs text-muted-foreground">{event.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">
                        R$ {event.price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </p>
                      <p className="text-xs text-muted-foreground">{event.available_tickets} ingressos</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
