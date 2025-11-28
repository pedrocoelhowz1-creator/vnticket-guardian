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

      const { checkIsAdmin } = await import('@/lib/adminCheck');
      const isAdmin = await checkIsAdmin(
        currentSession.user.id,
        currentSession.user.email || ''
      );

      if (!isAdmin) {
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
              <form onSubmit={handleSubmit} className="space-y-4">
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
                            className="w-full h-40 object-contain"
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

                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog} className="border-border/50">
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={saving || uploadingImage}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {uploadingImage ? "Enviando..." : saving ? "Salvando..." : editingEvent ? "Atualizar" : "Criar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
                      className="w-full h-full object-cover"
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
                      <span>{format(new Date(event.date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
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
