import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Ticket, Loader2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Session } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";

interface Event {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string;
  price: number;
  available_tickets: number;
  image_url: string | null;
  image_fit: string | null;
  category: string | null;
  has_fee: boolean;
  fee_amount: number;
  producer_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  ticket_types?: PriceOption[];
}

interface PriceOption {
  name: string;
  price: number;
}

interface ManualTicketFormData {
  event_uuid: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_cpf: string;
  sale_type: string;
  ticket_type_name: string;
  ticket_type_price: number | null;
}

const initialFormData: ManualTicketFormData = {
  event_uuid: "",
  buyer_name: "",
  buyer_phone: "",
  buyer_cpf: "",
  sale_type: "",
  ticket_type_name: "",
  ticket_type_price: null
};

const ManualTicket = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ManualTicketFormData>(initialFormData);
  const navigate = useNavigate();
  const { toast } = useToast();

  const formatEventDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "--/--/--";
    return format(d, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
  };

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (!currentSession?.user) {
        navigate("/auth");
        return;
      }

      const { checkIsAdmin } = await import('@/lib/adminCheck');
      const hasAccess = await checkIsAdmin(currentSession.user.id, currentSession.user.email || '');

      if (!hasAccess) {
        toast({
          title: "Acesso negado",
          description: "Apenas administradores podem criar ingressos manuais",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      loadEvents();
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
  }, [navigate, toast]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qqdtwekialqpakjgbonh.supabase.co';
      const functionUrl = `${supabaseUrl}/functions/v1/manage-events?action=list`;

      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
        },
        body: JSON.stringify({})
      });

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Resposta inválida do servidor');
      }

      if (data && data.events && Array.isArray(data.events)) {
        setEvents(data.events);
      } else if (Array.isArray(data)) {
        setEvents(data);
      } else if (!res.ok) {
        const errorMessage = data.error || data.message || `Erro ${res.status}: ${res.statusText}`;
        throw new Error(errorMessage);
      } else {
        setEvents([]);
      }
    } catch (error: any) {
      console.error('Error loading events:', error);
      toast({
        title: "Erro ao carregar eventos",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive"
      });
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.event_uuid || !formData.buyer_name || !formData.buyer_phone || !formData.buyer_cpf || !formData.sale_type) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const selectedEvent = events.find((e) => e.id === formData.event_uuid);
    const eventTicketTypes = Array.isArray(selectedEvent?.ticket_types) ? selectedEvent?.ticket_types : [];
    if (eventTicketTypes.length > 0 && !formData.ticket_type_name) {
      toast({
        title: "Tipo de ingresso obrigatório",
        description: "Selecione o tipo de ingresso (pista, VIP, etc)",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qqdtwekialqpakjgbonh.supabase.co';

      const res = await fetch(`${supabaseUrl}/functions/v1/create-manual-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erro ao criar ingresso');

      toast({
        title: "Ingresso criado com sucesso!",
        description: `Ingresso manual criado para ${formData.buyer_name}`
      });

      // Reset form
      setFormData(initialFormData);
    } catch (error: any) {
      console.error('Error creating manual ticket:', error);
      toast({
        title: "Erro ao criar ingresso",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
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
          <p className="mt-4 text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background circuit-bg">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/events")}
            className="hover:bg-secondary/50"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <img src={logo} alt="VN TICKET" className="w-8 h-8 object-contain" />
            <h1 className="text-lg font-bold">Criar Ingresso Manual</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 animate-fade-in">
        <div className="max-w-2xl mx-auto">
          <Card className="stats-card neon-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="h-5 w-5 text-primary" />
                Dados do Ingresso
              </CardTitle>
              <CardDescription className="text-xs">
                Preencha as informações para criar um ingresso manual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="event_uuid">Evento *</Label>
                  <Select
                    value={formData.event_uuid}
                    onValueChange={(value) => {
                      const selectedEvent = events.find((e) => e.id === value);
                      const ticketTypes = Array.isArray(selectedEvent?.ticket_types) ? selectedEvent?.ticket_types : [];
                      const defaultType = ticketTypes.length > 0 ? ticketTypes[0] : null;
                      setFormData({
                        ...formData,
                        event_uuid: value,
                        ticket_type_name: defaultType?.name || "",
                        ticket_type_price: defaultType?.price ?? null
                      });
                    }}
                  >
                    <SelectTrigger className="bg-secondary/50 border-border/50 focus:border-primary">
                      <SelectValue placeholder="Selecione um evento" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.length === 0 && (
                        <SelectItem value="" disabled>Nenhum evento disponível</SelectItem>
                      )}
                      {events.map(event => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title} - {formatEventDate(event.date)} - {event.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="buyer_name">Nome do Comprador *</Label>
                    <Input
                      id="buyer_name"
                      placeholder="Nome completo"
                      value={formData.buyer_name}
                      onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                      required
                      className="bg-secondary/50 border-border/50 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buyer_phone">Telefone *</Label>
                    <Input
                      id="buyer_phone"
                      placeholder="(11) 99999-9999"
                      value={formData.buyer_phone}
                      onChange={(e) => setFormData({ ...formData, buyer_phone: e.target.value })}
                      required
                      className="bg-secondary/50 border-border/50 focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="buyer_cpf">CPF *</Label>
                    <Input
                      id="buyer_cpf"
                      placeholder="000.000.000-00"
                      value={formData.buyer_cpf}
                      onChange={(e) => setFormData({ ...formData, buyer_cpf: e.target.value })}
                      required
                      className="bg-secondary/50 border-border/50 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sale_type">Tipo de Venda *</Label>
                    <Select
                      value={formData.sale_type}
                      onValueChange={(value) => setFormData({ ...formData, sale_type: value })}
                    >
                      <SelectTrigger className="bg-secondary/50 border-border/50 focus:border-primary">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online_whatsapp">Online/WhatsApp (com QR Code)</SelectItem>
                        <SelectItem value="presencial">Presencial (sem QR Code)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ticket_type">Tipo de Ingresso</Label>
                  <Select
                    value={formData.ticket_type_name}
                    onValueChange={(value) => {
                      const selectedEvent = events.find((e) => e.id === formData.event_uuid);
                      const ticketTypes = Array.isArray(selectedEvent?.ticket_types) ? selectedEvent?.ticket_types : [];
                      const selectedType = ticketTypes.find((t) => t.name === value);
                      setFormData({
                        ...formData,
                        ticket_type_name: value,
                        ticket_type_price: selectedType?.price ?? null
                      });
                    }}
                    disabled={!formData.event_uuid}
                  >
                    <SelectTrigger className="bg-secondary/50 border-border/50 focus:border-primary">
                      <SelectValue placeholder="Selecione o tipo (pista, VIP...)" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const selectedEvent = events.find((e) => e.id === formData.event_uuid);
                        const ticketTypes = Array.isArray(selectedEvent?.ticket_types) ? selectedEvent?.ticket_types : [];
                        if (ticketTypes.length === 0) {
                          return <SelectItem value="" disabled>Nenhum tipo cadastrado</SelectItem>;
                        }
                        return ticketTypes.map((type) => (
                          <SelectItem key={type.name} value={type.name}>
                            {type.name} - R$ {Number(type.price || 0).toFixed(2)}
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                  {formData.ticket_type_name && formData.ticket_type_price !== null && (
                    <p className="text-xs text-muted-foreground">
                      Preço do tipo selecionado: R$ {Number(formData.ticket_type_price || 0).toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-border/30">
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/events")}
                      className="flex-1 border-border/50 hover:bg-secondary/50"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Criar Ingresso
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ManualTicket;
