import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

      {/* Simple test content */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard de Reportes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            El módulo de reportes gerenciales se está cargando correctamente.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">127</div>
              <div className="text-sm text-muted-foreground">Órdenes Activas</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">892</div>
              <div className="text-sm text-muted-foreground">Pacientes Activos</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">87%</div>
              <div className="text-sm text-muted-foreground">Tasa de Asistencia</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}