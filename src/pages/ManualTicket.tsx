import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TicketPlus, User, CreditCard, Download, QrCode, Loader2, CheckCircle } from "lucide-react";
import QRCode from "react-qr-code";

interface Event {
  id: string;
  title: string;
  date: string;
  price: number;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credito", label: "Cartão Crédito" },
  { value: "debito", label: "Cartão Débito" },
  { value: "cortesia", label: "Cortesia" },
  { value: "outro", label: "Outro" },
];

const ManualTicket = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    buyerName: "",
    buyerCpf: "",
    buyerPhone: "",
    eventId: "",
    paymentMethod: "",
    isPresencial: false,
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/manage-events?action=list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseKey || ''
        },
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      } else if (Array.isArray(data)) {
        setEvents(data);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      toast({
        title: "Erro ao carregar eventos",
        description: "Tente novamente mais tarde",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.buyerName || !formData.buyerCpf || !formData.buyerPhone || !formData.eventId || !formData.paymentMethod) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const selectedEvent = events.find(e => e.id === formData.eventId);
      const ticketId = crypto.randomUUID();
      
      // Generate QR payload only if not presencial
      let generatedQrPayload: string | null = null;
      if (!formData.isPresencial) {
        const qrData = {
          ticketId,
          eventId: formData.eventId,
          buyerCpf: formData.buyerCpf.replace(/\D/g, ''),
          timestamp: Date.now()
        };
        generatedQrPayload = btoa(JSON.stringify(qrData));
      }

      // Insert manual ticket
      const { error } = await supabase.from('manual_tickets').insert({
        id: ticketId,
        event_id: formData.eventId,
        buyer_name: formData.buyerName,
        buyer_cpf: formData.buyerCpf.replace(/\D/g, ''),
        buyer_phone: formData.buyerPhone.replace(/\D/g, ''),
        payment_method: formData.paymentMethod,
        sale_type: formData.isPresencial ? 'presencial' : 'online',
        sale_origin: 'whatsapp',
        qr_generated: !formData.isPresencial,
        qr_payload: generatedQrPayload,
        status: 'valid',
        price: selectedEvent?.price || 0,
        created_by: session.user.id
      });

      if (error) throw error;

      setQrPayload(generatedQrPayload);
      setSuccess(true);
      toast({
        title: "Ingresso criado com sucesso!",
        description: formData.isPresencial 
          ? "Ingresso liberado para entrada presencial" 
          : "QR Code gerado para envio via WhatsApp"
      });

    } catch (error: any) {
      console.error('Error creating ticket:', error);
      toast({
        title: "Erro ao criar ingresso",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `ingresso-${formData.buyerName.replace(/\s/g, '-')}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleNewTicket = () => {
    setFormData({
      buyerName: "",
      buyerCpf: "",
      buyerPhone: "",
      eventId: "",
      paymentMethod: "",
      isPresencial: false,
    });
    setQrPayload(null);
    setSuccess(false);
  };

  if (success) {
    return (
      <AppLayout>
        <div className="p-6 max-w-2xl mx-auto animate-fade-in">
          <Card className="card-premium">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <CardTitle className="text-2xl">Ingresso Criado!</CardTitle>
              <CardDescription>
                {formData.isPresencial 
                  ? "O ingresso foi liberado para entrada presencial" 
                  : "O QR Code está pronto para envio"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Ticket Summary */}
              <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comprador:</span>
                  <span className="font-medium">{formData.buyerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPF:</span>
                  <span className="font-medium">{formData.buyerCpf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Evento:</span>
                  <span className="font-medium">{events.find(e => e.id === formData.eventId)?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagamento:</span>
                  <span className="font-medium capitalize">{formData.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className={`font-medium ${formData.isPresencial ? 'text-accent' : 'text-primary'}`}>
                    {formData.isPresencial ? 'Presencial' : 'Online'}
                  </span>
                </div>
              </div>

              {/* QR Code */}
              {qrPayload && (
                <div className="flex flex-col items-center space-y-4">
                  <div ref={qrRef} className="bg-white p-4 rounded-xl">
                    <QRCode value={qrPayload} size={200} />
                  </div>
                  <Button 
                    onClick={handleDownloadQR}
                    className="w-full btn-premium"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar QR Code
                  </Button>
                </div>
              )}

              <Button 
                onClick={handleNewTicket}
                variant="outline"
                className="w-full"
              >
                <TicketPlus className="mr-2 h-4 w-4" />
                Criar Novo Ingresso
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient-primary">Criar Ingresso Manual</h1>
          <p className="text-muted-foreground mt-2">
            Crie ingressos para vendas via WhatsApp ou presenciais
          </p>
        </div>

        <Card className="card-premium max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TicketPlus className="h-5 w-5 text-primary" />
              Novo Ingresso
            </CardTitle>
            <CardDescription>
              Preencha os dados do comprador e do ingresso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dados do Comprador */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User className="h-4 w-4" />
                  Dados do Comprador
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="buyerName">Nome Completo *</Label>
                  <Input
                    id="buyerName"
                    placeholder="Digite o nome completo"
                    value={formData.buyerName}
                    onChange={(e) => setFormData({ ...formData, buyerName: e.target.value })}
                    className="bg-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="buyerCpf">CPF *</Label>
                    <Input
                      id="buyerCpf"
                      placeholder="000.000.000-00"
                      value={formData.buyerCpf}
                      onChange={(e) => setFormData({ ...formData, buyerCpf: formatCpf(e.target.value) })}
                      maxLength={14}
                      className="bg-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="buyerPhone">Telefone *</Label>
                    <Input
                      id="buyerPhone"
                      placeholder="(00) 00000-0000"
                      value={formData.buyerPhone}
                      onChange={(e) => setFormData({ ...formData, buyerPhone: formatPhone(e.target.value) })}
                      maxLength={15}
                      className="bg-input"
                    />
                  </div>
                </div>
              </div>

              {/* Dados do Ingresso */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <QrCode className="h-4 w-4" />
                  Dados do Ingresso
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventId">Evento *</Label>
                  <Select
                    value={formData.eventId}
                    onValueChange={(value) => setFormData({ ...formData, eventId: value })}
                  >
                    <SelectTrigger className="bg-input">
                      <SelectValue placeholder="Selecione o evento" />
                    </SelectTrigger>
                    <SelectContent>
                      {loading ? (
                        <SelectItem value="loading" disabled>Carregando...</SelectItem>
                      ) : events.length === 0 ? (
                        <SelectItem value="empty" disabled>Nenhum evento disponível</SelectItem>
                      ) : (
                        events.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.title} - R$ {event.price?.toFixed(2)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Método de Pagamento *</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                  >
                    <SelectTrigger className="bg-input">
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tipo de Venda */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  Tipo de Venda
                </div>

                <div className="flex items-center space-x-3 p-4 bg-secondary/50 rounded-lg">
                  <Checkbox
                    id="isPresencial"
                    checked={formData.isPresencial}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, isPresencial: checked as boolean })
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor="isPresencial" className="cursor-pointer font-medium">
                      Venda realizada presencialmente
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.isPresencial 
                        ? "✓ O ingresso será liberado sem QR Code" 
                        : "Um QR Code será gerado para envio via WhatsApp"}
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full btn-premium"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <TicketPlus className="mr-2 h-4 w-4" />
                    {formData.isPresencial ? "Liberar Ingresso" : "Criar e Gerar QR Code"}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ManualTicket;
