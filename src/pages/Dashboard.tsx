import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  QrCode, LogOut, TrendingUp,
  Calendar, DollarSign,
  BarChart3, PieChart, Zap,
  Clock, Activity, Target, Award
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";
import {
  BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

interface SalesStats {
  totalEvents: number;
  totalSales: number;
  totalRevenue: number;
  totalTickets: number;
  validCheckins: number;
  invalidCheckins: number;
  todayRevenue: number;
  todaySales: number;
  weekRevenue: number;
  conversionRate: number;
  avgTicketPrice: number;
  eventStats: any[];
  chartData: any[];
  topEvents: any[];
  events: any[];
  lastUpdated: Date;
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
    weekRevenue: 0,
    conversionRate: 0,
    avgTicketPrice: 0,
    eventStats: [],
    chartData: [],
    topEvents: [],
    events: [],
    lastUpdated: new Date()
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

      // Criar mapa de eventos para lookup rápido
      const eventMap = new Map();
      (events || []).forEach(e => {
        eventMap.set(e.id, e);
      });

      // Buscar todos os checkins (sem tentar fazer join)
      const { data: checkinsRaw, error: checkinsError } = await supabase
        .from('checkins')
        .select('id, id_compra, id_evento, id_ingresso, buyer_email, validated_by, validated_at, status, reason, qr_payload');

      if (checkinsError) throw checkinsError;

      // Enriquecer checkins com dados de eventos
      let checkins = (checkinsRaw || []).map((c: any) => ({
        ...c,
        events: eventMap.get(c.id_evento)
      }));

      // Filtrar checkins do produtor se não for admin master
      if (!isAdminMaster && userId) {
        checkins = checkins.filter((c: any) => c.events?.producer_id === userId);
      }

      // Manual tickets - será adicionado quando tabela existir
      let manualTickets: any[] = [];

      // Calcular estatísticas
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const validCheckins = checkins?.filter(c => c.status === 'valid').length || 0;
      const invalidCheckins = checkins?.filter(c => c.status === 'invalid').length || 0;
      
      const todayCheckins = checkins?.filter(c => 
        new Date(c.validated_at) >= today
      ) || [];

      const weekCheckins = checkins?.filter(c =>
        new Date(c.validated_at) >= weekAgo && new Date(c.validated_at) <= today
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

      const weekRevenue = weekCheckins.reduce((sum, c: any) => {
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

      const conversionRate = totalTickets > 0 ? (validCheckins / totalTickets) * 100 : 0;
      const avgTicketPrice = totalTickets > 0 ? totalRevenue / totalTickets : 0;

      // Dados para gráfico de receita por dia
      const chartData: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayCheckins = checkins?.filter(c =>
          new Date(c.validated_at) >= dayStart && new Date(c.validated_at) <= dayEnd
        ) || [];

        const dayRevenue = dayCheckins.reduce((sum, c: any) => {
          const eventPrice = c.events?.price || 0;
          const fee = c.events?.has_fee ? (eventPrice * 0.10) : 0;
          return sum + eventPrice + fee;
        }, 0);

        chartData.push({
          date: date.toLocaleDateString('pt-BR', { weekday: 'short', month: 'numeric', day: 'numeric' }),
          revenue: dayRevenue,
          tickets: dayCheckins.length
        });
      }

      // Top eventos por receita
      const eventRevenueMap = new Map();
      checkins?.forEach((c: any) => {
        const eventId = c.events?.id;
        const eventTitle = c.events?.title || 'Desconhecido';
        const eventPrice = c.events?.price || 0;
        const fee = c.events?.has_fee ? (eventPrice * 0.10) : 0;
        const eventRevenue = eventPrice + fee;

        if (!eventRevenueMap.has(eventId)) {
          eventRevenueMap.set(eventId, { title: eventTitle, revenue: 0, tickets: 0 });
        }
        const current = eventRevenueMap.get(eventId);
        current.revenue += eventRevenue;
        current.tickets += 1;
      });

      const topEvents = Array.from(eventRevenueMap.values())
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5);

      // Dados para pie chart
      const eventStats = [
        { name: 'Válidos', value: validCheckins, color: '#10b981' },
        { name: 'Inválidos', value: invalidCheckins, color: '#ef4444' }
      ];

      setStats({
        totalEvents: events?.length || 0,
        totalSales: totalTickets,
        totalRevenue: totalRevenue,
        totalTickets: totalTickets,
        validCheckins: validCheckins,
        invalidCheckins: invalidCheckins,
        todayRevenue: todayRevenue,
        todaySales: todaySales,
        weekRevenue: weekRevenue,
        conversionRate: conversionRate,
        avgTicketPrice: avgTicketPrice,
        eventStats: eventStats,
        chartData: chartData,
        topEvents: topEvents,
        events: events || [],
        lastUpdated: new Date()
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
      <div className="min-h-screen flex items-center justify-center bg-black overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-600/30 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-600/30 to-transparent rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="mb-8">
            <div className="inline-block relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-xl blur-lg opacity-75 animate-pulse"></div>
              <img src={logo} alt="VN TICKET" className="relative w-24 h-24 rounded-xl" />
            </div>
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-transparent border-t-blue-400 mx-auto"></div>
          <p className="mt-6 text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-lg font-bold">
            Carregando seu dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-cyan-600/20 via-blue-600/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-gradient-to-b from-pink-600/10 via-purple-600/5 to-transparent rounded-full blur-3xl"></div>
      </div>

      {/* Header Premium */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="relative bg-black rounded-xl p-2">
                <img src={logo} alt="VN TICKET" className="w-8 h-8" />
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black">
                <span className="text-yellow-400">VN</span>
                <span className="text-white ml-2">TICKET</span>
              </h1>
              <p className="text-xs text-gray-500">{isAdmin ? '👑 Admin Master Dashboard' : '🎫 Seu Dashboard Premium'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-500">Atualizado</p>
              <p className="text-sm font-bold text-transparent bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text">
                {stats.lastUpdated.toLocaleTimeString('pt-BR')}
              </p>
            </div>
            <Button 
              onClick={handleLogout}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 shadow-lg shadow-red-500/20 transition-all"
              size="sm"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 relative z-10">
        {/* KPIs Ultra Premium - 4 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Receita Total */}
          <div className="relative">
            <Card className="relative border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-xl shadow-2xl transition-all duration-300 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-gray-300 mb-1">Receita Total</CardTitle>
                    <div className="text-4xl font-black bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                      R$ {(stats.totalRevenue / 1000).toFixed(1)}K
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-green-500/10 rounded-xl backdrop-blur-sm border border-emerald-500/20">
                    <DollarSign className="h-6 w-6 text-emerald-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <p className="text-xs text-gray-400">{stats.totalSales} ingressos vendidos</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Receita Hoje */}
          <div className="relative">
            <Card className="relative border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-xl shadow-2xl transition-all duration-300 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-gray-300 mb-1">Receita Hoje</CardTitle>
                    <div className="text-4xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                      R$ {stats.todayRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 0})}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-xl backdrop-blur-sm border border-blue-500/20">
                    <TrendingUp className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <p className="text-xs text-gray-400">{stats.todaySales} vendas hoje</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Taxa Conversão */}
          <div className="relative">
            <Card className="relative border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-xl shadow-2xl transition-all duration-300 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-gray-300 mb-1">Taxa Conversão</CardTitle>
                    <div className="text-4xl font-black bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                      {stats.conversionRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-purple-500/20 to-violet-500/10 rounded-xl backdrop-blur-sm border border-purple-500/20">
                    <Target className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <p className="text-xs text-gray-400">{stats.validCheckins} / {stats.totalTickets} válidos</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preço Médio */}
          <div className="relative">
            <Card className="relative border border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-xl shadow-2xl transition-all duration-300 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-gray-300 mb-1">Preço Médio</CardTitle>
                    <div className="text-4xl font-black bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                      R$ {stats.avgTicketPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-xl backdrop-blur-sm border border-orange-500/20">
                    <Award className="h-6 w-6 text-orange-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <p className="text-xs text-gray-400">Por ingresso</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Gráficos - Row Grande */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Gráfico Receita */}
          <div className="lg:col-span-2 relative">
            <Card className="relative border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-400" />
                      Performance (7 Dias)
                    </CardTitle>
                    <CardDescription className="text-gray-400 text-xs">Receita e volume de ingressos</CardDescription>
                  </div>
                  <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
                    <span className="text-xs font-bold text-blue-300">Em Tempo Real</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                    <XAxis dataKey="date" stroke="#888888" style={{fontSize: '12px'}} />
                    <YAxis stroke="#888888" style={{fontSize: '12px'}} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '2px solid #3b82f6',
                        borderRadius: '12px',
                        color: '#e2e8f0',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" name="Receita (R$)" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="tickets" fill="#3b82f6" name="Ingressos" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Pie Chart */}
          <div className="relative">
            <Card className="relative border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-purple-400" />
                  Validação
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs">Status dos ingressos</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={220}>
                  <RechartsPie data={stats.eventStats} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {stats.eventStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="mt-6 space-y-3">
                  {stats.eventStats.map((stat, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: stat.color}}></div>
                        <span className="text-sm text-gray-300">{stat.name}</span>
                      </div>
                      <span className="font-bold text-white">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: QrCode, label: 'Scanner QR', desc: 'Validar ingressos', color: 'from-blue-500 to-cyan-500', path: '/scanner', lightColor: 'blue' },
            { icon: Calendar, label: 'Eventos', desc: 'Gerenciar eventos', color: 'from-purple-500 to-violet-500', path: '/events', lightColor: 'purple' },
            { icon: Clock, label: 'Histórico', desc: 'Ver validações', color: 'from-emerald-500 to-green-500', path: '/history', lightColor: 'emerald' }
          ].map((action, idx) => {
            const Icon = action.icon;
            const colorValues = {
              'blue': { gradStart: '59, 130, 246', icon: '#06b6d4' },
              'purple': { gradStart: '147, 51, 234', icon: '#a78bfa' },
              'emerald': { gradStart: '16, 185, 129', icon: '#10b981' }
            };
            const colors = colorValues[action.lightColor as keyof typeof colorValues];
            
            return (
              <div key={idx} className="relative">
                <Card className="relative border border-white/10 bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all duration-300 overflow-hidden h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-white">{action.label}</CardTitle>
                        <CardDescription className="text-gray-400 text-xs">{action.desc}</CardDescription>
                      </div>
                      <div className={`p-3 bg-gradient-to-br ${action.color} bg-opacity-20 rounded-xl backdrop-blur-sm border border-white/10`}>
                        <Icon className="h-6 w-6" style={{color: colors.icon}} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button className={`w-full bg-gradient-to-r ${action.color} hover:shadow-lg text-white border-0 transition-all`} size="sm">
                      Abrir →
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Top Eventos + Resumo */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Top Eventos */}
          {stats.topEvents.length > 0 && (
            <div className="lg:col-span-2 relative">
              <Card className="relative border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardHeader className="border-b border-white/10 pb-4">
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    Top Eventos
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-xs">Ranking por receita</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {stats.topEvents.map((event: any, i) => (
                      <div key={i} className="group/item flex items-center gap-3 p-4 bg-gradient-to-r from-white/5 to-transparent rounded-xl hover:from-white/10 hover:to-white/5 transition-all border border-white/5 hover:border-white/10">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30">
                          <span className="text-sm font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-white text-sm truncate">{event.title}</h4>
                          <p className="text-xs text-gray-500">🎫 {event.tickets} ingressos</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                            R$ {(event.revenue / 1000).toFixed(1)}K
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Resumo */}
          <div className="relative">
            <Card className="relative border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-400" />
                  Resumo
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs">Semanalmente</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-400">Receita Semanal</span>
                    <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                      R$ {stats.weekRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 0})}
                    </span>
                  </div>
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent"></div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-400">Total Eventos</span>
                    <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                      {stats.totalEvents}
                    </span>
                  </div>
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent"></div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-400">Ingressos Válidos</span>
                    <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">
                      {stats.validCheckins}
                    </span>
                  </div>
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent"></div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-400">Ingressos Inválidos</span>
                    <span className="text-lg font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                      {stats.invalidCheckins}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Todos Eventos Grid */}
        {stats.events.length > 0 && (
          <div className="relative">
            <Card className="relative border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-400" />
                  Todos os Eventos <span className="text-sm font-normal text-gray-500">({stats.events.length})</span>
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs">Lista completa de eventos</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {stats.events.map((event, idx) => (
                    <div key={event.id} className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-white/10 hover:to-white/5 transition-all p-4 hover:border-white/20">
                      <div className="relative">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-bold text-white text-sm line-clamp-2">{event.title}</h4>
                          <span className="text-xs font-semibold text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full flex-shrink-0">#{idx + 1}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3 line-clamp-1">📍 {event.location}</p>
                        <div className="flex justify-between items-center pt-3 border-t border-white/10">
                          <span className="text-sm font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                            R$ {event.price.toLocaleString('pt-BR')}
                          </span>
                          <span className="text-xs text-gray-400">🎫 {event.available_tickets}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
