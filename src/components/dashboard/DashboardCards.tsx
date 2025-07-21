import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, FileText, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  activePatientsCount: number;
  todayAppointmentsCount: number;
  pendingOrdersCount: number;
  completedSessionsRate: number;
}

export function DashboardCards() {
  const [stats, setStats] = useState<DashboardStats>({
    activePatientsCount: 0,
    todayAppointmentsCount: 0,
    pendingOrdersCount: 0,
    completedSessionsRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        // Fetch active patients
        const { count: activePatientsCount } = await supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Fetch today's appointments
        const { count: todayAppointmentsCount } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('appointment_date', today)
          .in('status', ['scheduled', 'confirmed', 'in_progress']);

        // Fetch pending medical orders
        const { count: pendingOrdersCount } = await supabase
          .from('medical_orders')
          .select('*', { count: 'exact', head: true })
          .eq('completed', false);

        // Calculate completion rate for this month
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const { data: monthlyAppointments } = await supabase
          .from('appointments')
          .select('status')
          .gte('appointment_date', firstDayOfMonth)
          .lte('appointment_date', today);

        const completedCount = monthlyAppointments?.filter(apt => apt.status === 'completed').length || 0;
        const totalCount = monthlyAppointments?.length || 0;
        const completedSessionsRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        setStats({
          activePatientsCount: activePatientsCount || 0,
          todayAppointmentsCount: todayAppointmentsCount || 0,
          pendingOrdersCount: pendingOrdersCount || 0,
          completedSessionsRate,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const dashboardCards = [
    {
      title: "Pacientes Activos",
      value: loading ? "..." : stats.activePatientsCount.toString(),
      description: "Total de pacientes en tratamiento",
      icon: Users,
      color: "bg-medical-blue",
    },
    {
      title: "Turnos Hoy",
      value: loading ? "..." : stats.todayAppointmentsCount.toString(),
      description: "Turnos programados para hoy",
      icon: Calendar,
      color: "bg-medical-green",
    },
    {
      title: "Órdenes Pendientes",
      value: loading ? "..." : stats.pendingOrdersCount.toString(),
      description: "Órdenes médicas por procesar",
      icon: FileText,
      color: "bg-warning",
    },
    {
      title: "Tasa de Asistencia",
      value: loading ? "..." : `${stats.completedSessionsRate}%`,
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