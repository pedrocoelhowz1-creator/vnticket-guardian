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
import { Plus, Pencil, Trash2, Calendar, MapPin, DollarSign, Ticket, ArrowLeft, Image, Search, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Session } from "@supabase/supabase-js";

interface Event {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string;
  price: number;
  available_tickets: number;
  image_url: string | null;
  category: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface EventFormData {
  title: string;
  description: string;
  date: string;
  location: string;
  price: string;
  available_tickets: string;
  image_url: string;
  category: string;
}

const initialFormData: EventFormData = {
  title: "",
  description: "",
  date: "",
  location: "",
  price: "",
  available_tickets: "",
  image_url: "",
  category: ""
};

const CATEGORIES = [
  "Festas e Shows",
  "Esportes",
  "Stand Up Comedy",
  "Congressos"
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

      // Verificar se é admin
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

      loadEvents();
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

  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada. Faça login novamente.');
      }

      // URL correta do Supabase (Guardian = VN Ticket)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qqdtwekialqpakjgbonh.supabase.co';
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_9MkvN2POLK3J1Qh4GvfIHw_22oBYzGw';
      
      // Usa POST com action=list
      console.log('=== INICIANDO CARREGAMENTO DE EVENTOS ===');
      console.log('Supabase URL:', supabaseUrl);
      console.log('Session token present:', !!session.access_token);
      
      const functionUrl = `${supabaseUrl}/functions/v1/manage-events?action=list`;
      console.log('Function URL:', functionUrl);
      
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseKey || ''
        },
        body: JSON.stringify({})
      });

      console.log('Response received');
      console.log('Response status:', res.status);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));
      
      const responseText = await res.text();
      console.log('Response text length:', responseText.length);
      console.log('Response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Erro ao fazer parse da resposta:', parseError);
        throw new Error('Resposta inválida do servidor');
      }
      
      console.log('Events data:', data);
      
      // Se a resposta contém eventos, usa eles mesmo se houver erro
      if (data && data.events && Array.isArray(data.events)) {
        console.log(`✅ Carregando ${data.events.length} eventos`);
        console.log('Eventos recebidos:', data.events);
        setEvents(data.events);
        
        if (data.events.length === 0) {
          console.warn('⚠️ Array de eventos está vazio');
          toast({
            title: "Nenhum evento encontrado",
            description: "Não há eventos cadastrados no sistema",
            variant: "default"
          });
        }
        
        // Se houver erro mas também eventos, mostra aviso
        if (!res.ok && data.error) {
          toast({
            title: "Aviso",
            description: data.error,
            variant: "default"
          });
        }
      } else if (Array.isArray(data)) {
        console.log(`✅ Carregando ${data.length} eventos (formato array direto)`);
        console.log('Eventos recebidos:', data);
        setEvents(data);
        
        if (data.length === 0) {
          console.warn('⚠️ Array de eventos está vazio');
          toast({
            title: "Nenhum evento encontrado",
            description: "Não há eventos cadastrados no sistema",
            variant: "default"
          });
        }
      } else if (!res.ok) {
        // Só lança erro se não houver eventos na resposta
        const errorMessage = data.error || data.message || `Erro ${res.status}: ${res.statusText}`;
        console.error('Error response:', data);
        throw new Error(errorMessage);
      } else {
        console.warn('Formato de resposta inesperado:', data);
        console.warn('Tipo de data:', typeof data);
        console.warn('Keys de data:', data ? Object.keys(data) : 'data is null/undefined');
        setEvents([]);
        toast({
          title: "Formato de resposta inesperado",
          description: "A resposta do servidor não está no formato esperado",
          variant: "destructive"
        });
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

  const handleOpenDialog = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        description: event.description || "",
        date: event.date ? event.date.slice(0, 16) : "",
        location: event.location,
        price: String(event.price),
        available_tickets: String(event.available_tickets),
        image_url: event.image_url || "",
        category: event.category || ""
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
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione uma imagem",
          variant: "destructive"
        });
        return;
      }
      
      // Validar tamanho (máximo 5MB)
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
      
      // Criar nome único para o arquivo
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `event-images/${fileName}`;

      // Fazer upload para o Supabase Storage
      const { data, error } = await supabase.storage
        .from('events')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        // Se o bucket não existir, criar
        if (error.message.includes('not found') || error.message.includes('Bucket')) {
          toast({
            title: "Bucket não encontrado",
            description: "Criando bucket 'events' no Storage...",
          });
          
          // Tentar criar o bucket (requer permissões admin)
          const { error: createError } = await supabase.storage.createBucket('events', {
            public: true,
            fileSizeLimit: 5242880, // 5MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
          });

          if (createError) {
            console.error('Erro ao criar bucket:', createError);
            throw new Error('Não foi possível criar o bucket. Configure o bucket "events" no Supabase Storage manualmente.');
          }

          // Tentar upload novamente
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

      // Obter URL pública da imagem
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

      // Fazer upload da imagem se houver arquivo selecionado
      let imageUrl = formData.image_url;
      if (useImageUpload && imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          // Se o upload falhar, não salvar o evento
          return;
        }
      }

      const eventData = {
        title: formData.title,
        description: formData.description || null,
        date: new Date(formData.date).toISOString(),
        location: formData.location,
        price: parseFloat(formData.price),
        available_tickets: parseInt(formData.available_tickets),
        image_url: imageUrl || null,
        category: formData.category || null
      };

      const action = editingEvent ? 'update' : 'create';
      const body = editingEvent ? { id: editingEvent.id, ...eventData } : eventData;

      const response = await supabase.functions.invoke('manage-events', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body,
        method: 'POST'
      });

      // Check URL for action parameter workaround
      const url = new URL(`${window.location.origin}/manage-events?action=${action}`);

      // URL correta do Supabase (Guardian = VN Ticket)
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

      toast({
        title: editingEvent ? "Evento atualizado" : "Evento criado",
        description: `"${formData.title}" foi ${editingEvent ? 'atualizado' : 'criado'} com sucesso`
      });

      handleCloseDialog();
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

      // URL correta do Supabase (Guardian = VN Ticket)
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando eventos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Eventos
            </h1>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEvent ? "Editar Evento" : "Novo Evento"}</DialogTitle>
                <DialogDescription>
                  {editingEvent ? "Atualize as informações do evento" : "Preencha as informações do novo evento"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Festa de Cor - Dia da Consciência Negra"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    maxLength={200}
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Local *</Label>
                  <div className="relative">
                    <Input
                      id="location"
                      type="text"
                      placeholder="Digite o local do evento"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      list="location-suggestions"
                      required
                    />
                    <datalist id="location-suggestions">
                      {LOCATIONS.map(loc => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Digite o local ou selecione uma sugestão
                  </p>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="available_tickets">Ingressos Disponíveis *</Label>
                    <Input
                      id="available_tickets"
                      type="number"
                      min="1"
                      max="10000"
                      placeholder="200"
                      value={formData.available_tickets}
                      onChange={(e) => setFormData({ ...formData, available_tickets: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image">Imagem do Evento</Label>
                  
                  {/* Toggle entre Upload e URL */}
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      variant={useImageUpload ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setUseImageUpload(true);
                        setFormData({ ...formData, image_url: "" });
                      }}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Fazer Upload
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
                    >
                      <Image className="mr-2 h-4 w-4" />
                      Usar URL
                    </Button>
                  </div>

                  {useImageUpload ? (
                    <div className="space-y-2">
                      <Input
                        id="image_file"
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        disabled={uploadingImage}
                      />
                      {imagePreview && (
                        <div className="relative mt-2 rounded-lg overflow-hidden border">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-40 object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={handleRemoveImage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {uploadingImage && (
                        <p className="text-sm text-muted-foreground">Fazendo upload...</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        id="image_url"
                        type="url"
                        placeholder="https://exemplo.com/imagem.jpg"
                        value={formData.image_url}
                        onChange={(e) => {
                          setFormData({ ...formData, image_url: e.target.value });
                          setImagePreview(e.target.value || null);
                        }}
                      />
                      {formData.image_url && (
                        <div className="mt-2 rounded-lg overflow-hidden border">
                          <img
                            src={formData.image_url}
                            alt="Preview"
                            className="w-full h-40 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
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
                    placeholder="Descreva o evento em detalhes..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    maxLength={2000}
                    rows={4}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving || uploadingImage}>
                    {uploadingImage ? "Fazendo upload..." : saving ? "Salvando..." : editingEvent ? "Atualizar" : "Criar Evento"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filtrar categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {events.length === 0 
                  ? "Nenhum evento cadastrado ainda"
                  : "Nenhum evento encontrado com os filtros aplicados"
                }
              </p>
              {events.length === 0 && (
                <Button className="mt-4" onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeiro evento
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <Card key={event.id} className="shadow-soft overflow-hidden">
                {event.image_url ? (
                  <div className="h-48 overflow-hidden">
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-48 bg-muted flex items-center justify-center">
                    <Image className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg line-clamp-1">{event.title}</CardTitle>
                      {event.category && (
                        <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {event.category}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(event.date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <span>R$ {event.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4" />
                      <span>{event.available_tickets} ingressos</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleOpenDialog(event)}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover "{event.title}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(event)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Events;
