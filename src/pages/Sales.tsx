import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ShoppingCart, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";

interface Sale {
  id: string;
  event_id: string;
  quantity: number | null;
  total_amount: number | null;
  status: string;
  buyer_name: string | null;
  buyer_email: string | null;
  created_at: string;
  events?: any;
}

const Sales = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [selectedProducerId, setSelectedProducerId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("paid");
  const [buyerSearch, setBuyerSearch] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (!currentSession?.user) {
        navigate("/auth");
        return;
      }

      const { checkIsAdmin, checkIsAdminOrProducer } = await import("@/lib/adminCheck");
      const hasAccess = await checkIsAdminOrProducer(currentSession.user.id);

      if (!hasAccess) {
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      const admin = await checkIsAdmin(currentSession.user.id, currentSession.user.email || "");
      setIsAdmin(admin);
      await loadSales(currentSession.user.id, admin);
    };

    checkAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        checkAccess();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadSales = async (userId: string, admin: boolean) => {
    try {
      const eventsQuery = admin
        ? supabase.from("events").select("*")
        : supabase.from("events").select("*").eq("producer_id", userId);

      const { data: events, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;

      const eventMap = new Map((events || []).map((event: any) => [event.id, event]));
      setEvents(events || []);

      const { data: purchases, error: purchasesError } = await supabase
        .from("purchases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (purchasesError) throw purchasesError;

      let salesData = (purchases || []).map((p: any) => ({
        ...p,
        events: eventMap.get(p.event_id)
      }));

      if (!admin) {
        salesData = salesData.filter((p: any) => p.events?.producer_id === userId);
      }

      setSales(salesData);
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
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
          <p className="mt-4 text-muted-foreground text-sm">Carregando vendas...</p>
        </div>
      </div>
    );
  }

  const producerOptions = Array.from(
    new Map((events || []).map((event: any) => [event.producer_id, event])).values()
  );

  const filteredSales = sales.filter((sale) => {
    if (selectedStatus !== "all" && sale.status !== selectedStatus) return false;
    if (selectedEventId !== "all" && sale.event_id !== selectedEventId) return false;
    if (selectedProducerId !== "all" && sale.events?.producer_id !== selectedProducerId) return false;
    if (buyerSearch.trim()) {
      const query = buyerSearch.trim().toLowerCase();
      const name = sale.buyer_name?.toLowerCase() || "";
      const email = sale.buyer_email?.toLowerCase() || "";
      if (!name.includes(query) && !email.includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background circuit-bg pb-20">
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
            <h1 className="text-lg font-bold">Vendas</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 animate-fade-in">
        <Card className="relative border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-white/10 pb-4">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-purple-400" />
              Vendas Detalhadas
            </CardTitle>
            <CardDescription className="text-gray-400 text-xs">
                Filtre por produtor, evento, status ou comprador
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                <div>
                  <label className="text-xs text-gray-400">Status</label>
                  <select
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <option value="paid">Pago</option>
                    <option value="pending">Pendente</option>
                    <option value="canceled">Cancelado</option>
                    <option value="all">Todos</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Evento</label>
                  <select
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                      </option>
                    ))}
                  </select>
                </div>
                {isAdmin && (
                  <div>
                    <label className="text-xs text-gray-400">Produtor</label>
                    <select
                      className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                      value={selectedProducerId}
                      onChange={(e) => setSelectedProducerId(e.target.value)}
                    >
                      <option value="all">Todos</option>
                      {producerOptions.map((event) => (
                        <option key={event.producer_id} value={event.producer_id}>
                          {event.producer_id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-400">Comprador</label>
                  <Input
                    value={buyerSearch}
                    onChange={(e) => setBuyerSearch(e.target.value)}
                    placeholder="Nome ou email"
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Evento</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-semibold">Qtd</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Valor</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Comprador</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Data</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length > 0 ? (
                    filteredSales.map((sale) => (
                      <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{sale.events?.title || "Evento Desconhecido"}</td>
                        <td className="py-3 px-4 text-center text-gray-300">{sale.quantity || 1}</td>
                        <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                          R$ {(sale.total_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-gray-300">{sale.buyer_name || sale.buyer_email || "N/A"}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs">
                          {new Date(sale.created_at).toLocaleDateString("pt-BR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            sale.status === "paid"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : sale.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {sale.status === "paid" ? "✓ Pago" : sale.status === "pending" ? "⏳ Pendente" : "✗ Cancelado"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        Nenhuma venda encontrada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Sales;
