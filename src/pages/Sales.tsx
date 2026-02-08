import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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

      const { data: purchases, error: purchasesError } = await supabase
        .from("purchases")
        .select("*")
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(200);

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
              Compras com status pago
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
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
                  {sales.length > 0 ? (
                    sales.map((sale) => (
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
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                            ✓ Pago
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
