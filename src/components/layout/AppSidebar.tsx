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
    roles: ['admin', 'doctor', 'patient']
  },
  {
    title: "Citas",
    url: "/appointments",
    icon: Calendar,
    description: "Gestión de citas médicas",
    roles: ['admin', 'doctor', 'patient']
  },
  {
    title: "Pacientes",
    url: "/patients",
    icon: Users,
    description: "Gestión de pacientes",
    roles: ['admin', 'doctor', 'patient']
  },
  {
    title: "Profesionales",
    url: "/doctors",
    icon: UserCheck,
    description: "Gestión de profesionales",
    roles: ['admin', 'patient']
  },
  {
    title: "Órdenes Médicas",
    url: "/orders",
    icon: FileText,
    description: "Órdenes y prescripciones médicas",
    roles: ['admin', 'doctor']
  },
  {
    title: "Obras Sociales / ART",
    url: "/obras-sociales",
    icon: Building2,
    description: "Gestión de obras sociales y ART",
    roles: ['admin', 'doctor']
  },
  {
    title: "Presentaciones",
    url: "/presentaciones",
    icon: FileText,
    description: "Documentos para facturación por obra social",
    roles: ['admin', 'doctor']
  },
  {
    title: "Facturación",
    url: "/billing",
    icon: FileText,
    description: "Facturación por obra social y ART",
    roles: ['admin', 'reception']
  },
  {
    title: "Plus",
    url: "/plus-payments",
    icon: DollarSign,
    description: "Gestión de plus payments",
    roles: ['admin', 'reception']
  },
  {
    title: "Gestión de Caja",
    url: "/cash-management",
    icon: Wallet,
    description: "Control de ingresos, egresos y arqueos",
    roles: ['admin', 'reception']
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
    roles: ['admin', 'doctor', 'reception']
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
    const baseClasses = "w-full justify-start transition-colors";
    if (isActive(path)) {
      return `${baseClasses} bg-primary text-primary-foreground shadow-sm`;
    }
    return `${baseClasses} hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`;
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
            <img 
              src="/lovable-uploads/2800aff0-a779-4fb4-9ad8-7d20459df869.png" 
              alt="Rehabilitare Logo" 
              className="w-8 h-8 object-contain"
            />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-lg text-sidebar-foreground truncate">
              Rehabilitare
            </h2>
            <p className="text-sm text-sidebar-foreground/70 truncate">
              Centro de Kinesiología
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-6">
          <div>
            <div className="text-sidebar-foreground/70 font-medium mb-2 px-2">
              Principal
            </div>
            <div className="space-y-1">
              {filteredNavigationItems.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  className={getNavClassName(item.url)}
                  title={item.description}
                >
                  <div className="flex items-center gap-3 p-2 rounded-md">
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium truncate">{item.title}</span>
                  </div>
                </NavLink>
              ))}
            </div>
          </div>

          {filteredAdminItems.length > 0 && (
            <div>
              <div className="text-sidebar-foreground/70 font-medium mb-2 px-2">
                Administración
              </div>
              <div className="space-y-1">
                {filteredAdminItems.map((item) => (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    className={getNavClassName(item.url)}
                    title={item.description}
                  >
                    <div className="flex items-center gap-3 p-2 rounded-md">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium truncate">{item.title}</span>
                    </div>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}