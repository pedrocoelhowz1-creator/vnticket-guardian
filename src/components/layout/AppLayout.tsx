import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  QrCode,
  Calendar,
  History,
  TicketPlus,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  TrendingUp,
  Users,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/logo.png";

interface AppLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string;
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Calendar, label: "Eventos", path: "/events" },
  { icon: TicketPlus, label: "Criar Ingresso", path: "/manual-ticket" },
  { icon: QrCode, label: "Scanner", path: "/scanner" },
  { icon: History, label: "Histórico", path: "/history" },
  { icon: TrendingUp, label: "Vendas", path: "/sales" },
  { icon: Info, label: "Sobre", path: "/about" },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 p-4 border-b border-sidebar-border",
        collapsed && !isMobile ? "justify-center" : "justify-start"
      )}>
        <img src={logo} alt="VN Ticket" className="h-10 w-auto" />
        {(!collapsed || isMobile) && (
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gradient-primary">VN TICKET</span>
            <span className="text-xs text-muted-foreground">Sistema do Produtor</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              if (isMobile) setMobileOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200",
              "hover:bg-sidebar-accent text-sidebar-foreground",
              isActive(item.path) && "bg-primary/10 text-primary border-l-2 border-primary",
              collapsed && !isMobile ? "justify-center" : "justify-start"
            )}
          >
            <item.icon className={cn(
              "h-5 w-5 flex-shrink-0",
              isActive(item.path) ? "text-primary" : "text-muted-foreground"
            )} />
            {(!collapsed || isMobile) && (
              <span className="font-medium">{item.label}</span>
            )}
            {item.badge && (!collapsed || isMobile) && (
              <span className="ml-auto px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-sidebar-border">
        {(!collapsed || isMobile) && userEmail && (
          <div className="mb-3 px-3">
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200",
            "hover:bg-destructive/10 text-muted-foreground hover:text-destructive",
            collapsed && !isMobile ? "justify-center" : "justify-start"
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {(!collapsed || isMobile) && <span className="font-medium">Sair</span>}
        </button>
      </div>

      {/* Collapse Button - Desktop only */}
      {!isMobile && (
        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col border-r border-border transition-all duration-300",
        collapsed ? "w-20" : "w-64"
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          <img src={logo} alt="VN Ticket" className="h-8 w-auto" />
          <div className="w-10" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
