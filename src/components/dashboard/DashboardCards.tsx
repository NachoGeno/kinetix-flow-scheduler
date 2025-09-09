import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, FileText, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  activePatientsCount: number;
  todayAppointmentsCount: number;
  pendingOrdersCount: number;
  completedSessionsRate: number;
}

export function DashboardCards() {
  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ['dashboard-stats', 'organization-aware'],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.functions.invoke('dashboard-stats');
      
      if (error) {
        console.error('Error fetching dashboard stats:', error);
        throw error;
      }
      
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - dashboard data can be slightly stale
    gcTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const dashboardCards = [
    {
      title: "Pacientes Activos",
      value: loading ? "..." : stats?.activePatientsCount.toString() || "0",
      description: "Total de pacientes en tratamiento",
      icon: Users,
      color: "bg-medical-blue",
    },
    {
      title: "Turnos Hoy",
      value: loading ? "..." : stats?.todayAppointmentsCount.toString() || "0",
      description: "Turnos programados para hoy",
      icon: Calendar,
      color: "bg-medical-green",
    },
    {
      title: "Órdenes Pendientes",
      value: loading ? "..." : stats?.pendingOrdersCount.toString() || "0",
      description: "Órdenes médicas por procesar",
      icon: FileText,
      color: "bg-warning",
    },
    {
      title: "Tasa de Asistencia",
      value: loading ? "..." : `${stats?.completedSessionsRate || 0}%`,
      description: "Sesiones completadas este mes",
      icon: TrendingUp,
      color: "bg-success",
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {dashboardCards.map((card, index) => (
        <Card key={index} className="relative overflow-hidden bg-gradient-card shadow-card hover:shadow-elevated transition-all duration-300 border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.color} text-white`}>
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}