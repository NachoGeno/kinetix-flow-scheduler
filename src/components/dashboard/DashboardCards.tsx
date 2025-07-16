import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, FileText, TrendingUp, Clock, CheckCircle } from "lucide-react";

const stats = [
  {
    title: "Pacientes Activos",
    value: "156",
    description: "Total de pacientes en tratamiento",
    icon: Users,
    trend: "+12%",
    color: "bg-medical-blue",
  },
  {
    title: "Turnos Hoy",
    value: "24",
    description: "Turnos programados para hoy",
    icon: Calendar,
    trend: "+3",
    color: "bg-medical-green",
  },
  {
    title: "Órdenes Pendientes",
    value: "8",
    description: "Órdenes médicas por procesar",
    icon: FileText,
    trend: "-2",
    color: "bg-warning",
  },
  {
    title: "Sesiones Completadas",
    value: "89%",
    description: "Tasa de asistencia del mes",
    icon: TrendingUp,
    trend: "+5%",
    color: "bg-success",
  },
];

export function DashboardCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card key={index} className="relative overflow-hidden bg-gradient-card shadow-card hover:shadow-elevated transition-all duration-300 border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.color} text-white`}>
              <stat.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
            <div className="flex items-center mt-2">
              <span className={`text-xs font-medium ${
                stat.trend.startsWith('+') ? 'text-success' : 
                stat.trend.startsWith('-') ? 'text-destructive' : 
                'text-muted-foreground'
              }`}>
                {stat.trend}
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                vs. mes anterior
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}