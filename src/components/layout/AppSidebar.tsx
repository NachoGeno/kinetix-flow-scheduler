import { useState } from "react";
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

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

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
    title: "Plus Payments",
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
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { profile } = useAuth();

  const filteredNavigationItems = navigationItems.filter(item => {
    if (!item.roles || !profile?.role) return true;
    return item.roles.includes(profile.role);
  });

  const filteredAdminItems = adminItems.filter(() => {
    return profile?.role === 'admin';
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
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Heart className="w-6 h-6 text-white" />
          </div>
          {open && (
            <div>
              <h2 className="font-semibold text-lg text-sidebar-foreground">
                Rehabilitare
              </h2>
              <p className="text-sm text-sidebar-foreground/70">
                Centro de Kinesiología
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 font-medium mb-2">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {filteredNavigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={getNavClassName(item.url)}
                      title={item.description}
                    >
                      <item.icon className="w-5 h-5" />
                      {open && (
                        <span className="font-medium">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredAdminItems.length > 0 && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-sidebar-foreground/70 font-medium mb-2">
              Administración
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {filteredAdminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={getNavClassName(item.url)}
                      title={item.description}
                    >
                      <item.icon className="w-5 h-5" />
                      {open && (
                        <span className="font-medium">{item.title}</span>
                      )}
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