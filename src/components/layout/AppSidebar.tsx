import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Calendar,
  Users,
  UserCheck,
  FileText,
  ClipboardList,
  BarChart3,
  Settings,
  Activity,
  Building2,
  DollarSign,
  Wallet,
  MessageCircle
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Activity,
    description: "Vista general del sistema",
    roles: ['admin', 'doctor', 'patient', 'secretaria']
  },
  {
    title: "Citas",
    url: "/appointments",
    icon: Calendar,
    description: "Gestión de citas médicas",
    roles: ['admin', 'doctor', 'patient', 'secretaria']
  },
  {
    title: "Pacientes",
    url: "/patients",
    icon: Users,
    description: "Gestión de pacientes",
    roles: ['admin', 'doctor', 'patient', 'secretaria']
  },
  {
    title: "Profesionales",
    url: "/doctors",
    icon: UserCheck,
    description: "Gestión de profesionales",
    roles: ['admin', 'patient', 'secretaria']
  },
  {
    title: "Órdenes Médicas",
    url: "/orders",
    icon: FileText,
    description: "Órdenes y prescripciones médicas",
    roles: ['admin', 'doctor', 'secretaria']
  },
  {
    title: "Obras Sociales / ART",
    url: "/obras-sociales",
    icon: Building2,
    description: "Gestión de obras sociales y ART",
    roles: ['admin', 'doctor', 'secretaria']
  },
  {
    title: "Presentaciones",
    url: "/presentaciones",
    icon: FileText,
    description: "Documentos para facturación por obra social",
    roles: ['admin', 'doctor', 'secretaria']
  },
  {
    title: "Facturación",
    url: "/billing",
    icon: FileText,
    description: "Facturación por obra social y ART",
    roles: ['admin']
  },
  {
    title: "Plus",
    url: "/plus-payments",
    icon: DollarSign,
    description: "Gestión de plus payments",
    roles: ['admin', 'reception', 'secretaria']
  },
  {
    title: "Gestión de Caja",
    url: "/cash-management",
    icon: Wallet,
    description: "Control de ingresos, egresos y arqueos",
    roles: ['admin', 'reception', 'secretaria']
  },
  {
    title: "Historia Clínica",
    url: "/medical-records",
    icon: ClipboardList,
    description: "Historiales clínicos",
    roles: ['admin', 'doctor', 'patient', 'secretaria']
  },
  {
    title: "Novedades",
    url: "/novedades",
    icon: MessageCircle,
    description: "Comunicación interna del equipo",
    roles: ['admin', 'doctor', 'reception', 'secretaria']
  },
  {
    title: "Reportes",
    url: "/reports",
    icon: BarChart3,
    description: "Reportes y estadísticas",
    roles: ['admin']
  },
  {
    title: "Reportes Gerenciales",
    url: "/reports-manager",
    icon: BarChart3,
    description: "Dashboard ejecutivo y KPIs",
    roles: ['super_admin', 'reports_manager']
  }
];

const adminItems = [
  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
    description: "Configuración del sistema"
  }
];

export function AppSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { profile } = useAuth();
  const { state } = useSidebar();

  const filteredNavigationItems = navigationItems.filter(item => {
    if (!item.roles || !profile?.role) return true;
    return item.roles.includes(profile.role);
  });

  const filteredAdminItems = adminItems.filter(() => {
    return profile?.role === 'admin' || profile?.role === 'super_admin';
  });

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-background border border-border flex items-center justify-center flex-shrink-0">
            <img 
              src="/lovable-uploads/2800aff0-a779-4fb4-9ad8-7d20459df869.png" 
              alt="Rehabilitare Logo" 
              className="w-8 h-8 object-contain"
            />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h2 className="font-semibold text-lg text-foreground truncate">
                Rehabilitare
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                Centro de Kinesiología
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.description}>
                    <NavLink to={item.url}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Navigation */}
        {filteredAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.description}>
                      <NavLink to={item.url}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
