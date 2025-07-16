import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Calendar,
  Users,
  UserCheck,
  FileText,
  ClipboardList,
  BarChart3,
  Settings,
  Heart,
  Activity
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
    description: "Vista general del sistema"
  },
  {
    title: "Calendario",
    url: "/calendario",
    icon: Calendar,
    description: "Gestión de turnos y horarios"
  },
  {
    title: "Pacientes",
    url: "/pacientes",
    icon: Users,
    description: "Gestión de pacientes"
  },
  {
    title: "Profesionales",
    url: "/profesionales",
    icon: UserCheck,
    description: "Gestión de profesionales"
  },
  {
    title: "Órdenes Médicas",
    url: "/ordenes",
    icon: FileText,
    description: "Órdenes y autorizaciones"
  },
  {
    title: "Historia Clínica",
    url: "/historia-clinica",
    icon: ClipboardList,
    description: "Evolutivos y registros"
  },
  {
    title: "Informes",
    url: "/informes",
    icon: BarChart3,
    description: "Reportes y estadísticas"
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
                MediTurnos
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
              {navigationItems.map((item) => (
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

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-sidebar-foreground/70 font-medium mb-2">
            Administración
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {adminItems.map((item) => (
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
      </SidebarContent>
    </Sidebar>
  );
}