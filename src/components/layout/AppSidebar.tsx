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
  Heart,
  Activity,
  Building2,
  DollarSign,
  Wallet,
  MessageCircle
} from "lucide-react";


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
    roles: ['admin', 'doctor', 'patient']
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

  const getNavClassName = (path: string) => {
    const baseClasses = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full";
    if (isActive(path)) {
      return `${baseClasses} bg-primary text-primary-foreground font-medium shadow-sm`;
    }
    return `${baseClasses} text-foreground hover:bg-accent hover:text-accent-foreground`;
  };

  return (
    <aside className="w-64 h-full bg-card border-r border-border flex flex-col">
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
          <div className="min-w-0">
            <h2 className="font-semibold text-lg text-foreground truncate">
              Rehabilitare
            </h2>
            <p className="text-sm text-muted-foreground truncate">
              Centro de Kinesiología
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-auto p-4">
        <div className="space-y-6">
          {/* Main Navigation */}
          <div>
            <h3 className="text-muted-foreground font-medium mb-3 px-2 text-sm uppercase tracking-wider">
              Principal
            </h3>
            <ul className="space-y-1">
              {filteredNavigationItems.map((item) => (
                <li key={item.title}>
                  <NavLink
                    to={item.url}
                    className={getNavClassName(item.url)}
                    title={item.description}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium truncate">{item.title}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Admin Navigation */}
          {filteredAdminItems.length > 0 && (
            <div>
              <h3 className="text-muted-foreground font-medium mb-3 px-2 text-sm uppercase tracking-wider">
                Administración
              </h3>
              <ul className="space-y-1">
                {filteredAdminItems.map((item) => (
                  <li key={item.title}>
                    <NavLink
                      to={item.url}
                      className={getNavClassName(item.url)}
                      title={item.description}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium truncate">{item.title}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}