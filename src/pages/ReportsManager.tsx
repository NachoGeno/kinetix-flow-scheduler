import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardOverview } from "@/components/reports-manager/DashboardOverview";
import { AttendanceChart } from "@/components/reports-manager/AttendanceChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, FileText, Users, TrendingUp, Settings } from "lucide-react";

export default function ReportsManager() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Reportes Gerenciales
        </h1>
        <p className="text-muted-foreground">
          Panel de control ejecutivo con KPIs y análisis operativo
        </p>
      </div>

      {/* Dashboard Overview - Siempre visible */}
      <DashboardOverview />

      {/* Tabs para diferentes secciones */}
      <Tabs defaultValue="operational" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="operational" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Operativo
          </TabsTrigger>
          <TabsTrigger value="productivity" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Productividad
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Órdenes
          </TabsTrigger>
          <TabsTrigger value="patients" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Pacientes
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Calidad
          </TabsTrigger>
        </TabsList>

        {/* Operativo Diario */}
        <TabsContent value="operational" className="space-y-6">
          <AttendanceChart />
          
          <Card>
            <CardHeader>
              <CardTitle>Análisis Operativo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">87%</div>
                  <div className="text-sm text-muted-foreground">Ocupación Promedio</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">12min</div>
                  <div className="text-sm text-muted-foreground">Tiempo Promedio Espera</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">4.8</div>
                  <div className="text-sm text-muted-foreground">Satisfacción Promedio</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Productividad por Profesional */}
        <TabsContent value="productivity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Productividad por Profesional</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Análisis de rendimiento y utilización de capacidad por profesional.
              </p>
              <div className="mt-4 text-sm text-muted-foreground">
                Esta sección está en desarrollo. Pronto incluirá:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Sesiones completadas por profesional</li>
                  <li>Tasa de utilización de horarios</li>
                  <li>Comparativo mensual de productividad</li>
                  <li>Análisis de eficiencia por especialidad</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipeline de Órdenes */}
        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline de Órdenes Médicas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Análisis del flujo de órdenes médicas y su estado de completitud.
              </p>
              <div className="mt-4 text-sm text-muted-foreground">
                Esta sección está en desarrollo. Pronto incluirá:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Estado de órdenes por fase</li>
                  <li>Tiempo promedio de ciclo</li>
                  <li>Órdenes con documentación pendiente</li>
                  <li>Análisis de eficiencia por obra social</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Análisis de Pacientes */}
        <TabsContent value="patients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Pacientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Métricas de adquisición, retención y satisfacción de pacientes.
              </p>
              <div className="mt-4 text-sm text-muted-foreground">
                Esta sección está en desarrollo. Pronto incluirá:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Nuevos pacientes por mes</li>
                  <li>Tasa de retención de pacientes</li>
                  <li>Análisis demográfico</li>
                  <li>Segmentación por obra social</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Control de Calidad */}
        <TabsContent value="quality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Control de Calidad</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Métricas de calidad de atención y completitud documental.
              </p>
              <div className="mt-4 text-sm text-muted-foreground">
                Esta sección está en desarrollo. Pronto incluirá:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Completitud de historias clínicas</li>
                  <li>Tiempo de respuesta de documentación</li>
                  <li>Auditoría de procesos</li>
                  <li>Indicadores de cumplimiento normativo</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}