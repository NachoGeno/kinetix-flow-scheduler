import { Calendar, Users, FileText, Clock, UserCheck, AlertTriangle } from "lucide-react";
import { KPICard } from "./KPICard";
import { useKPICore } from "@/hooks/useReportsManager";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardOverview() {
  const { data: kpis, isLoading, error } = useKPICore();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Error al cargar los KPIs principales</p>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No hay datos disponibles</p>
      </div>
    );
  }

  const attendanceRate = kpis.today_total_appointments > 0 
    ? Math.round((kpis.today_completed_appointments / kpis.today_total_appointments) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Resumen Ejecutivo
        </h2>
        <p className="text-muted-foreground">
          Vista general del rendimiento de la organización
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard
          title="Citas Hoy"
          value={`${kpis.today_completed_appointments}/${kpis.today_total_appointments}`}
          subtitle={`${attendanceRate}% completadas`}
          icon={Calendar}
          trend={attendanceRate >= 80 ? { value: attendanceRate - 75, isPositive: true } : undefined}
        />

        <KPICard
          title="Órdenes Activas"
          value={kpis.active_orders}
          subtitle="En tratamiento"
          icon={FileText}
          className="border-l-4 border-l-primary"
        />

        <KPICard
          title="Documentos Pendientes"
          value={kpis.pending_docs}
          subtitle="Requieren atención"
          icon={AlertTriangle}
          className={kpis.pending_docs > 0 ? "border-l-4 border-l-yellow-500" : ""}
        />

        <KPICard
          title="Pacientes Activos"
          value={kpis.active_patients}
          subtitle="En seguimiento"
          icon={Users}
        />

        <KPICard
          title="Nuevos Pacientes"
          value={kpis.new_patients_month}
          subtitle="Este mes"
          icon={UserCheck}
          className="border-l-4 border-l-green-500"
        />

        <KPICard
          title="Tasa de Asistencia"
          value={`${attendanceRate}%`}
          subtitle="Promedio hoy"
          icon={Clock}
          trend={{ 
            value: attendanceRate - 75, 
            isPositive: attendanceRate >= 75 
          }}
        />
      </div>
    </div>
  );
}