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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => {
      subscription.unsubscribe();
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop();
      }
    };
  }, [navigate]);

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
      const scanner = new Html5Qrcode("qr-reader");
      html5QrcodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        () => {} // Ignore scan errors
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
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current = null;
        setScanning(false);
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
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
      const { data, error } = await supabase.functions.invoke('validate-ticket', {
        body: { qrPayload, eventId },
      });

      if (error) {
        console.error("Validation error:", error);
        setResult({
          status: 'error',
          reason: 'Erro ao validar ingresso',
        });
        toast({
          title: "Erro na validação",
          description: error.message || "Erro ao comunicar com servidor",
          variant: "destructive",
        });
        return;
      }

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
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b bg-card shadow-soft sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Validar Ingresso</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>ID do Evento</CardTitle>
            <CardDescription>Informe o UUID do evento antes de escanear</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="eventId">UUID do Evento</Label>
              <Input
                id="eventId"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={scanning || validating}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ScanLine className="h-5 w-5" />
              <span>Scanner QR Code</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              id="qr-reader" 
              ref={scannerRef}
              className="w-full rounded-lg overflow-hidden"
              style={{ display: scanning ? 'block' : 'none' }}
            />

            {!scanning && !validating && (
              <Button onClick={startScanner} className="w-full" size="lg">
                Iniciar Scanner
              </Button>
            )}

            {scanning && (
              <Button onClick={stopScanner} variant="destructive" className="w-full" size="lg">
                Parar Scanner
              </Button>
            )}

            {validating && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Validando ingresso...</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Validação Manual</CardTitle>
            <CardDescription>Cole o código QR manualmente</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualValidation} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manualQr">Código QR (Base64)</Label>
                <Input
                  id="manualQr"
                  name="manualQr"
                  placeholder="Cole o código aqui..."
                  disabled={scanning || validating}
                />
              </div>
              <Button type="submit" variant="outline" className="w-full" disabled={scanning || validating}>
                Validar Manualmente
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card className={`shadow-strong ${result.status === 'valid' ? 'border-success' : 'border-destructive'} border-2`}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {result.status === 'valid' ? (
                  <CheckCircle className="h-6 w-6 text-success" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
                <span>{result.status === 'valid' ? 'Ingresso Válido' : 'Ingresso Inválido'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.reason && (
                <p className="text-sm text-muted-foreground">
                  <strong>Motivo:</strong> {result.reason}
                </p>
              )}
              {result.data && (
                <div className="text-sm space-y-1">
                  {result.data.buyer_name && (
                    <p><strong>Nome:</strong> {result.data.buyer_name}</p>
                  )}
                  {result.data.email && (
                    <p><strong>Email:</strong> {result.data.email}</p>
                  )}
                  {result.data.quantity && (
                    <p><strong>Quantidade:</strong> {result.data.quantity}</p>
                  )}
                  {result.data.event_name && (
                    <p><strong>Evento:</strong> {result.data.event_name}</p>
                  )}
                </div>
              )}
              <Button 
                onClick={() => {
                  setResult(null);
                  if (!scanning) startScanner();
                }} 
                className="w-full mt-4"
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