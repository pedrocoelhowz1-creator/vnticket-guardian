import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle, Loader2, ScanLine } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import type { Session } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";

interface ValidationResult {
  status: 'valid' | 'invalid' | 'error';
  reason?: string;
  data?: any;
}

const Scanner = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [scanning, setScanning] = useState(false);
  const [validating, setValidating] = useState(false);
  const [eventId, setEventId] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (!currentSession?.user) {
        navigate("/auth");
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentSession.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError || !roleData) {
        toast({
          title: "Acesso negado",
          description: "Apenas administradores podem acessar este sistema",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }
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

    return () => {
      subscription.unsubscribe();
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current
          .stop()
          .then(() => html5QrcodeRef.current?.clear())
          .catch((error) => {
            console.error("Error stopping scanner on cleanup:", error);
          });
      }
    };
  }, [navigate, toast]);

  const startScanner = async () => {
    if (!eventId.trim()) {
      toast({
        title: "ID do evento necessário",
        description: "Informe o ID do evento antes de escanear",
        variant: "destructive",
      });
      return;
    }

    try {
      if (html5QrcodeRef.current) {
        try {
          await html5QrcodeRef.current.stop();
          await html5QrcodeRef.current.clear();
        } catch (innerError) {
          console.warn("Falha ao limpar instância anterior do scanner:", innerError);
        }
      }

      const scanner = new Html5Qrcode("qr-reader");
      html5QrcodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        () => {}
      );

      setScanning(true);
      setResult(null);
    } catch (error) {
      console.error("Error starting scanner:", error);
      toast({
        title: "Erro ao iniciar câmera",
        description: "Verifique se concedeu permissão para usar a câmera",
        variant: "destructive",
      });
    }
  };

  const stopScanner = async () => {
    if (!html5QrcodeRef.current) return;

    try {
      await html5QrcodeRef.current.stop();
      await html5QrcodeRef.current.clear();
    } catch (error) {
      console.error("Error stopping/clearing scanner:", error);
    } finally {
      html5QrcodeRef.current = null;
      setScanning(false);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    await stopScanner();
    await validateTicket(decodedText);
  };

  const validateTicket = async (qrPayload: string) => {
    setValidating(true);
    setResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setResult({
          status: 'error',
          reason: 'Usuário não autenticado',
        });
        toast({
          title: "Erro de autenticação",
          description: "Faça login novamente para validar ingressos.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://qqdtwekialqpakjgbonh.supabase.co'}/functions/v1/validate-ticket`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ qrPayload, eventId }),
        }
      );

      const data = await response.json();

      setResult(data);

      if (data.status === 'valid') {
        toast({
          title: "✅ Ingresso Válido!",
          description: `Bem-vindo, ${data.data?.buyer_name || data.data?.email}`,
        });
      } else {
        toast({
          title: "❌ Ingresso Inválido",
          description: data.reason,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      setResult({
        status: 'error',
        reason: 'Erro inesperado ao validar',
      });
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  const handleManualValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const manualQr = formData.get('manualQr') as string;
    
    if (manualQr.trim()) {
      await validateTicket(manualQr.trim());
    }
  };

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
            <h1 className="text-lg font-bold">Validar Ingresso</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4 animate-fade-in">
        {/* Event ID Card */}
        <Card className="stats-card neon-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ID do Evento</CardTitle>
            <CardDescription className="text-xs">Informe o UUID do evento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="eventId" className="text-xs text-muted-foreground">UUID</Label>
              <Input
                id="eventId"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={scanning || validating}
                className="h-11 bg-secondary/50 border-border/50 focus:border-primary font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Scanner Card */}
        <Card className="stats-card neon-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanLine className="h-5 w-5 text-primary" />
              Scanner QR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              id="qr-reader" 
              ref={scannerRef}
              className="w-full rounded-xl overflow-hidden min-h-[260px] bg-background/80 border border-border/30"
            />

            {!scanning && !validating && (
              <Button 
                onClick={startScanner} 
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
              >
                Iniciar Scanner
              </Button>
            )}

            {scanning && (
              <Button 
                onClick={stopScanner} 
                variant="destructive" 
                className="w-full h-12"
              >
                Parar Scanner
              </Button>
            )}

            {validating && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Validando...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Validation */}
        <Card className="stats-card neon-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Validação Manual</CardTitle>
            <CardDescription className="text-xs">Cole o código QR</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualValidation} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manualQr" className="text-xs text-muted-foreground">Código (Base64)</Label>
                <Input
                  id="manualQr"
                  name="manualQr"
                  placeholder="Cole o código aqui..."
                  disabled={scanning || validating}
                  className="h-11 bg-secondary/50 border-border/50 focus:border-primary font-mono text-xs"
                />
              </div>
              <Button 
                type="submit" 
                variant="outline" 
                className="w-full h-11 border-border/50 hover:bg-secondary/50" 
                disabled={scanning || validating}
              >
                Validar Manualmente
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Result Card */}
        {result && (
          <Card className={`neon-border animate-scale-in ${
            result.status === 'valid' 
              ? 'border-success/50 bg-success/5' 
              : 'border-destructive/50 bg-destructive/5'
          }`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                {result.status === 'valid' ? (
                  <CheckCircle className="h-6 w-6 text-success" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
                <span className={result.status === 'valid' ? 'text-success' : 'text-destructive'}>
                  {result.status === 'valid' ? 'Ingresso Válido' : 'Ingresso Inválido'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.reason && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Motivo:</span> {result.reason}
                </p>
              )}
              {result.data && (
                <div className="text-sm space-y-1 bg-secondary/30 rounded-lg p-3">
                  {result.data.buyer_name && (
                    <p><span className="text-muted-foreground">Nome:</span> {result.data.buyer_name}</p>
                  )}
                  {result.data.email && (
                    <p><span className="text-muted-foreground">Email:</span> {result.data.email}</p>
                  )}
                  {result.data.quantity && (
                    <p><span className="text-muted-foreground">Quantidade:</span> {result.data.quantity}</p>
                  )}
                  {result.data.event_name && (
                    <p><span className="text-muted-foreground">Evento:</span> {result.data.event_name}</p>
                  )}
                </div>
              )}
              <Button 
                onClick={() => {
                  setResult(null);
                  if (!scanning) startScanner();
                }} 
                className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Escanear Próximo
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Scanner;
