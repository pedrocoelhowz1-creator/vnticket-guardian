import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Calendar, MapPin, DollarSign, Ticket, ArrowLeft, Image, Search, Upload, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ptBR } from "date-fns/locale";
import type { Session } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";

interface PriceOption {
  name: string;
  price: number;
}

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
  is_available: boolean;
  unavailability_reason: string | null;
  prices?: PriceOption[];
  created_at: string | null;
  updated_at: string | null;
}

interface EventFormData {
  title: string;
  description: string;
  date: string;
  location: string;
  price: string;
  mainPriceName: string;
  available_tickets: string;
  image_url: string;
  image_fit: string;
  category: string;
  producer_id: string;
  has_fee: boolean;
  fee_amount: string;
  is_available: boolean;
  unavailability_reason: string;
  prices: PriceOption[];
}

const initialFormData: EventFormData = {
  title: "",
  description: "",
  date: "",
  location: "",
  price: "",
  mainPriceName: "",
  available_tickets: "",
  image_url: "",
  image_fit: "contain",
  category: "",
  producer_id: "",
  has_fee: false,
  fee_amount: "",
  is_available: true,
  unavailability_reason: "",
  prices: []
};

const CATEGORIES = [
  "Festas e Shows",
  "Esportes",
  "Stand Up Comedy",
  "Congressos",
  "Viagem"
];

const LOCATIONS = [
  "St Serp Juazeiro",
  "Arena Juazeiro",
  "Teatro Municipal",
  "Ginásio Poliesportivo",
  "Centro de Convenções",
  "Clube Juazeiro",
  "Bar & Arte Cultural",
  "Parque da Cidade",
  "Hotel Executivo",
  "Warehouse Club",
  "Orla 2 Juazeiro-BA"
];

const Events = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [useImageUpload, setUseImageUpload] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [producers, setProducers] = useState<{id: string, email: string}[]>([]);
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

      const { checkIsAdmin, checkIsAdminOrProducer } = await import('@/lib/adminCheck');
      const hasAccess = await checkIsAdminOrProducer(currentSession.user.id);
      const adminStatus = await checkIsAdmin(currentSession.user.id, currentSession.user.email || '');

      if (!hasAccess) {
        toast({
          title: "Acesso negado",
          description: "Apenas administradores e produtores podem acessar este sistema",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      setIsAdmin(adminStatus);
      console.log('User is admin:', adminStatus);
      loadEvents();
      if (adminStatus) {
        loadProducers();
      }
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
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9MkvN2POLK3J1Qh4GvfIHw_22oBYzGw';

      const functionUrl = `${supabaseUrl}/functions/v1/manage-events?action=list`;

      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseKey || ''
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

  const loadProducers = async () => {
    try {
      // Get producer roles
      const { data: producerRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'producer');

      if (rolesError) {
        console.error('Error loading producer roles:', rolesError);
        // If there's an error with the relationship, try a simpler approach
        setProducers([]);
        return;
      }

      if (!producerRoles || producerRoles.length === 0) {
        setProducers([]);
        return;
      }

      // For now, create placeholder entries - in production you'd want to get actual user emails
      const producerList = producerRoles.map((role, index) => ({
        id: role.user_id,
        email: `Produtor ${index + 1} (${role.user_id.slice(0, 8)}...)`
      }));

      setProducers(producerList);
      console.log('Loaded producers:', producerList);
    } catch (error: any) {
      console.error('Error loading producers:', error);
      // Don't show error toast for this, just set empty list
      setProducers([]);
    }
  };

  const handleOpenDialog = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      
      // Converte is_available para booleano corretamente (pode vir como string)
      let isAvailable = true;
      if (event.is_available !== undefined && event.is_available !== null) {
        if (typeof event.is_available === 'string') {
          isAvailable = event.is_available === 'true' || event.is_available === '1';
        } else {
          isAvailable = Boolean(event.is_available);
        }
      }
      
      // Carrega mainPriceName do primeiro item do array prices se existir
      let mainPriceName = "";
      let otherPrices: PriceOption[] = [];
      
      console.log('📋 Raw event.prices:', event.prices);
      console.log('📋 Type of event.prices:', typeof event.prices);
      
      if (Array.isArray(event.prices) && event.prices.length > 0) {
        // Se tem prices como array, pega o primeiro como mainPrice
        const firstPrice = event.prices[0];
        console.log('📋 Primeiro preço:', firstPrice);
        
        if (firstPrice && typeof firstPrice === 'object' && 'name' in firstPrice) {
          mainPriceName = firstPrice.name || "";
        }
        
        // Adiciona os outros preços (a partir do segundo)
        otherPrices = event.prices.slice(1);
        console.log('📋 Outros preços:', otherPrices);
      } else {
        // Fallback: se prices não está populado, log para debug
        console.log('📋 Nenhum preço no array, prices vazio ou undefined');
        console.log('📋 event.prices:', event.prices);
      }
      
      console.log('📋 Abrindo evento para edição:');
      console.log('ID:', event.id);
      console.log('Título:', event.title);
      console.log('mainPriceName carregado:', mainPriceName);
      console.log('prices carregados:', otherPrices);
      console.log('is_available (raw):', event.is_available);
      console.log('is_available (converted):', isAvailable);
      
      setFormData({
        title: event.title,
        description: event.description || "",
        date: event.date ? event.date.slice(0, 16) : "",
        location: event.location,
        price: String(event.price),
        mainPriceName: mainPriceName,
        available_tickets: String(event.available_tickets),
        image_url: event.image_url || "",
        image_fit: event.image_fit || "contain",
        category: event.category || "",
        producer_id: (event as any).producer_id || "",
        has_fee: event.has_fee || false,
        fee_amount: String(event.fee_amount || ""),
        is_available: isAvailable,
        unavailability_reason: event.unavailability_reason || "",
        prices: otherPrices
      });
      setImagePreview(event.image_url || null);
      setUseImageUpload(false);
      setImageFile(null);
    } else {
      setEditingEvent(null);
      setFormData(initialFormData);
      setImagePreview(null);
      setImageFile(null);
      setUseImageUpload(false);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEvent(null);
    setFormData(initialFormData);
    setImageFile(null);
    setImagePreview(null);
    setUseImageUpload(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione uma imagem",
          variant: "destructive"
        });
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "A imagem deve ter no máximo 5MB",
          variant: "destructive"
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setUseImageUpload(true);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, image_url: "" });
    setUseImageUpload(false);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !session) return null;

    try {
      setUploadingImage(true);
      
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `event-images/${fileName}`;

      const { data, error } = await supabase.storage
        .from('events')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        if (error.message.includes('not found') || error.message.includes('Bucket')) {
          const { error: createError } = await supabase.storage.createBucket('events', {
            public: true,
            fileSizeLimit: 5242880,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
          });

          if (createError) {
            throw new Error('Não foi possível criar o bucket.');
          }

          const { data: retryData, error: retryError } = await supabase.storage
            .from('events')
            .upload(filePath, imageFile);

          if (retryError) throw retryError;
          
          const { data: urlData } = supabase.storage
            .from('events')
            .getPublicUrl(filePath);
          
          return urlData.publicUrl;
        }
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from('events')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: "Erro ao fazer upload",
        description: error.message || "Não foi possível fazer upload da imagem",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddPrice = () => {
    setFormData({
      ...formData,
      prices: [...formData.prices, { name: "", price: 0 }]
    });
  };

  const handleRemovePrice = (index: number) => {
    setFormData({
      ...formData,
      prices: formData.prices.filter((_, i) => i !== index)
    });
  };

  const handleUpdatePrice = (index: number, field: keyof PriceOption, value: string | number) => {
    const updatedPrices = [...formData.prices];
    if (field === "name") {
      updatedPrices[index].name = value as string;
    } else if (field === "price") {
      updatedPrices[index].price = parseFloat(value as string) || 0;
    }
    setFormData({
      ...formData,
      prices: updatedPrices
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.date || !formData.location || !formData.price || !formData.available_tickets) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();

      let imageUrl = formData.image_url;
      if (useImageUpload && imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          return;
        }
      }

      // Verificar se é producer para associar o evento
      const { checkIsProducer } = await import('@/lib/adminCheck');
      const isProducer = await checkIsProducer(session?.user?.id || '');

      const producerId = isAdmin ? (formData.producer_id === "none" ? null : (formData.producer_id || null)) : (isProducer ? session?.user?.id : null);

      const eventData = {
        title: formData.title,
        description: formData.description || null,
        date: new Date(formData.date).toISOString(),
        location: formData.location,
        price: parseFloat(formData.price),
        available_tickets: parseInt(formData.available_tickets),
        image_url: imageUrl || null,
        category: formData.category || null,
        producer_id: producerId,
        has_fee: formData.has_fee,
        fee_amount: formData.has_fee ? parseFloat(formData.fee_amount) : 0,
        is_available: formData.is_available,
        unavailability_reason: !formData.is_available ? formData.unavailability_reason : null,
        prices: [
          // Se mainPriceName tem valor, adiciona como primeiro item
          ...(formData.mainPriceName.trim() ? [{ name: formData.mainPriceName, price: parseFloat(formData.price) }] : []),
          // Adiciona os outros preços
          ...formData.prices
        ]
      };

      console.log('📤 Enviando eventData:', eventData);

      const action = editingEvent ? 'update' : 'create';
      const body = editingEvent ? { id: editingEvent.id, ...eventData } : eventData;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qqdtwekialqpakjgbonh.supabase.co';
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9MkvN2POLK3J1Qh4GvfIHw_22oBYzGw';
      
      const res = await fetch(`${supabaseUrl}/functions/v1/manage-events?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': supabaseKey || ''
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

      // Atualiza o estado local imediatamente com a resposta do servidor
      if (data.event) {
        const updatedEvent = data.event;
        
        if (editingEvent) {
          // Atualiza o evento na lista local
          setEvents(prevEvents =>
            prevEvents.map(e =>
              e.id === updatedEvent.id
                ? {
                    ...updatedEvent,
                    id: updatedEvent.id,
                    title: updatedEvent.title,
                    description: updatedEvent.description,
                    date: updatedEvent.date,
                    location: updatedEvent.location,
                    price: updatedEvent.price,
                    available_tickets: updatedEvent.available_tickets,
                    image_url: updatedEvent.image_url,
                    image_fit: updatedEvent.image_fit,
                    category: updatedEvent.category,
                    has_fee: updatedEvent.has_fee,
                    fee_amount: updatedEvent.fee_amount,
                    producer_id: updatedEvent.producer_id,
                    is_available: updatedEvent.is_available,
                    unavailability_reason: updatedEvent.unavailability_reason,
                    prices: updatedEvent.prices || [],
                    created_at: updatedEvent.created_at,
                    updated_at: updatedEvent.updated_at
                  }
                : e
            )
          );
        } else {
          // Adiciona novo evento à lista
          setEvents(prevEvents => [...prevEvents, updatedEvent]);
        }
      }

      toast({
        title: editingEvent ? "Evento atualizado" : "Evento criado",
        description: `"${formData.title}" foi ${editingEvent ? 'atualizado' : 'criado'} com sucesso`
      });

      handleCloseDialog();
      // Ainda chama loadEvents() para sincronizar em background se houver mudanças
      loadEvents();
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: "Erro ao salvar evento",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: Event) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qqdtwekialqpakjgbonh.supabase.co';
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9MkvN2POLK3J1Qh4GvfIHw_22oBYzGw';
      
      const res = await fetch(`${supabaseUrl}/functions/v1/manage-events?action=delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': supabaseKey || ''
        },
        body: JSON.stringify({ id: event.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir');

      toast({
        title: "Evento excluído",
        description: `"${event.title}" foi excluído com sucesso`
      });

      loadEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        title: "Erro ao excluir evento",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive"
      });
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || event.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background circuit-bg">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4">
            <img src={logo} alt="VN TICKET" className="w-full h-full object-contain animate-float" />
          </div>
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground text-sm">Carregando eventos...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-background circuit-bg">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
              <h1 className="text-lg font-bold gradient-text">Eventos</h1>
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                onClick={() => navigate("/manual-ticket")}
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Ticket className="mr-2 h-4 w-4" />
                Criar ingresso manual
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => handleOpenDialog()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Novo
                  </Button>
                </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border/50">
              <DialogHeader>
                <DialogTitle className="gradient-text">{editingEvent ? "Editar Evento" : "Novo Evento"}</DialogTitle>
                <DialogDescription>
                  {editingEvent ? "Atualize as informações do evento" : "Preencha as informações do novo evento"}
                </DialogDescription>
              </DialogHeader>
              <form id="event-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Festa de Cor"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    maxLength={200}
                    className="bg-secondary/50 border-border/50 focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data e Hora *</Label>
                    <Input
                      id="date"
                      type="datetime-local"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      className="bg-secondary/50 border-border/50 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger className="bg-secondary/50 border-border/50">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="producer">Produtor</Label>
                    <Select value={formData.producer_id} onValueChange={(value) => setFormData({ ...formData, producer_id: value })}>
                      <SelectTrigger className="bg-secondary/50 border-border/50">
                          <SelectValue placeholder="Selecione um produtor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum (evento geral)</SelectItem>
                          {producers.length === 0 && (
                            <SelectItem value="none" disabled>Nenhum produtor cadastrado</SelectItem>
                          )}
                          {producers.map(producer => (
                            <SelectItem key={producer.id} value={producer.id}>{producer.email}</SelectItem>
                          ))}
                        </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="location">Local *</Label>
                  <Input
                    id="location"
                    type="text"
                    placeholder="Digite o local"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    list="location-suggestions"
                    required
                    className="bg-secondary/50 border-border/50 focus:border-primary"
                  />
                  <datalist id="location-suggestions">
                    {LOCATIONS.map(loc => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço (R$) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      max="10000"
                      placeholder="50.00"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                      className="bg-secondary/50 border-border/50 focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mainPriceName">Nome do Tipo (Opcional)</Label>
                    <Input
                      id="mainPriceName"
                      type="text"
                      placeholder="Ex: Pista, Inteira, VIP..."
                      value={formData.mainPriceName}
                      onChange={(e) => setFormData({ ...formData, mainPriceName: e.target.value })}
                      className="bg-secondary/50 border-border/50 focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="available_tickets">Ingressos *</Label>
                  <Input
                    id="available_tickets"
                    type="number"
                    min="1"
                    max="10000"
                    placeholder="200"
                    value={formData.available_tickets}
                    onChange={(e) => setFormData({ ...formData, available_tickets: e.target.value })}
                    required
                    className="bg-secondary/50 border-border/50 focus:border-primary"
                  />
                </div>

                <div className="space-y-4 border-t border-border/30 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Tipos de Ingressos (Opcional)</h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddPrice}
                      className="border-border/50 hover:bg-primary/10"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  
                  {formData.prices.length > 0 && (
                    <div className="space-y-3 bg-secondary/20 p-4 rounded-lg border border-border/30">
                      {formData.prices.map((priceOption, index) => (
                        <div key={index} className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Nome do tipo</Label>
                            <Input
                              type="text"
                              placeholder="Ex: Pista, Camarote, VIP"
                              value={priceOption.name}
                              onChange={(e) => handleUpdatePrice(index, "name", e.target.value)}
                              className="bg-secondary/50 border-border/50 focus:border-primary text-sm"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Preço (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={priceOption.price || ""}
                              onChange={(e) => handleUpdatePrice(index, "price", e.target.value)}
                              className="bg-secondary/50 border-border/50 focus:border-primary text-sm"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRemovePrice(index)}
                            className="h-10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground mt-2">
                        💡 Adicione diferentes categorias de ingressos (pista, camarote, VIP, etc) com seus respectivos preços. Isso será exibido no site de vendas.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="has_fee"
                      checked={formData.has_fee}
                      onChange={(e) => setFormData({ ...formData, has_fee: e.target.checked })}
                      className="rounded border-border/50"
                    />
                    <Label htmlFor="has_fee">Adicionar taxa de serviço</Label>
                  </div>

                  {formData.has_fee && (
                    <div className="space-y-2">
                      <Label htmlFor="fee_amount">Valor da taxa (R$) *</Label>
                      <Input
                        id="fee_amount"
                        type="number"
                        step="0.01"
                        min="0"
                        max="1000"
                        placeholder="5.00"
                        value={formData.fee_amount}
                        onChange={(e) => setFormData({ ...formData, fee_amount: e.target.value })}
                        required={formData.has_fee}
                        className="bg-secondary/50 border-border/50 focus:border-primary"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-t border-border/30 pt-4">
                  <h3 className="text-sm font-semibold">Disponibilidade do Evento</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_available"
                      checked={formData.is_available}
                      onChange={(e) => {
                        console.log('✅ Checkbox clicado:');
                        console.log('Novo valor:', e.target.checked);
                        setFormData({ ...formData, is_available: e.target.checked });
                      }}
                      className="rounded border-border/50"
                    />
                    <Label htmlFor="is_available">Evento disponível para compra</Label>
                  </div>

                  {!formData.is_available && (
                    <div className="space-y-2">
                      <Label htmlFor="unavailability_reason">Motivo da indisponibilidade</Label>
                      <Textarea
                        id="unavailability_reason"
                        placeholder="Ex: Evento será prorrogado, aguarde novas datas..."
                        value={formData.unavailability_reason}
                        onChange={(e) => setFormData({ ...formData, unavailability_reason: e.target.value })}
                        maxLength={500}
                        rows={3}
                        className="bg-secondary/50 border-border/50 focus:border-primary resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.unavailability_reason.length}/500
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Imagem do Evento</Label>
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      variant={useImageUpload ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setUseImageUpload(true);
                        setFormData({ ...formData, image_url: "" });
                      }}
                      className={useImageUpload ? "bg-primary text-primary-foreground" : "border-border/50"}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                    <Button
                      type="button"
                      variant={!useImageUpload ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setUseImageUpload(false);
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className={!useImageUpload ? "bg-primary text-primary-foreground" : "border-border/50"}
                    >
                      <Image className="mr-2 h-4 w-4" />
                      URL
                    </Button>
                  </div>

                  {useImageUpload ? (
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        disabled={uploadingImage}
                        className="bg-secondary/50 border-border/50"
                      />
                      {imagePreview && (
                        <div className="relative mt-2 rounded-lg overflow-hidden border border-border/50 bg-secondary/30">
                          <img src={imagePreview} alt="Preview" className="w-full h-40 object-contain" />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8"
                            onClick={handleRemoveImage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        type="url"
                        placeholder="https://exemplo.com/imagem.jpg"
                        value={formData.image_url}
                        onChange={(e) => {
                          setFormData({ ...formData, image_url: e.target.value });
                          setImagePreview(e.target.value || null);
                        }}
                        className="bg-secondary/50 border-border/50 focus:border-primary"
                      />
                      {formData.image_url && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-border/50 bg-secondary/30">
                          <img
                            src={formData.image_url}
                            alt="Preview"
                            className={`w-full h-40 object-${formData.image_fit || 'contain'}`}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o evento..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    maxLength={2000}
                    rows={3}
                    className="bg-secondary/50 border-border/50 focus:border-primary resize-none"
                  />
                </div>
              </form>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog} className="border-border/50">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  form="event-form"
                  disabled={saving || uploadingImage}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {uploadingImage ? "Enviando..." : saving ? "Salvando..." : editingEvent ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 animate-fade-in">
        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar eventos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-secondary/50 border-border/50 focus:border-primary"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full md:w-44 bg-secondary/50 border-border/50">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <Card className="stats-card neon-border">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-primary/50 mb-4" />
              <p className="text-muted-foreground">
                {events.length === 0 ? "Nenhum evento cadastrado" : "Nenhum evento encontrado"}
              </p>
              {events.length === 0 && (
                <Button className="mt-4 bg-primary hover:bg-primary/90" onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar evento
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event, index) => (
              <Card 
                key={event.id} 
                className="stats-card neon-border card-hover overflow-hidden animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {event.image_url ? (
                  <div className="h-40 overflow-hidden bg-secondary/30 flex items-center justify-center">
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className={`w-full h-full object-${event.image_fit || 'contain'}`}
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
                    />
                  </div>
                ) : (
                  <div className="h-40 bg-secondary/30 flex items-center justify-center">
                    <Image className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-1">{event.title}</CardTitle>
                    {event.category && (
                      <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {event.category}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>{formatEventDate(event.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-success" />
                        <span className="text-success font-medium">R$ {event.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Ticket className="h-3.5 w-3.5" />
                        <span>{event.available_tickets}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground/70 font-mono truncate">
                      {event.id}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 border-border/50 hover:bg-secondary/50"
                        onClick={() => handleOpenDialog(event)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Editar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="h-9 w-9 p-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border/50">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover "{event.title}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-border/50">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(event)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
    </ErrorBoundary>
  );
};

export default Events;
