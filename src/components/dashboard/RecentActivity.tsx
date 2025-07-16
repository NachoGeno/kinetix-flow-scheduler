import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Calendar, FileText } from "lucide-react";

const activities = [
  {
    id: 1,
    type: "appointment",
    title: "Turno confirmado",
    description: "María González - Dr. Fernández",
    time: "Hace 5 minutos",
    status: "confirmed",
    icon: Calendar,
  },
  {
    id: 2,
    type: "patient",
    title: "Nuevo paciente registrado",
    description: "Carlos Mendoza - DNI: 35.123.456",
    time: "Hace 15 minutos",
    status: "new",
    icon: User,
  },
  {
    id: 3,
    type: "order",
    title: "Orden médica cargada",
    description: "10 sesiones de kinesiología",
    time: "Hace 30 minutos",
    status: "pending",
    icon: FileText,
  },
  {
    id: 4,
    type: "appointment",
    title: "Sesión completada",
    description: "Ana Rodríguez - Evolutivo registrado",
    time: "Hace 1 hora",
    status: "completed",
    icon: Calendar,
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-success-light text-success-foreground';
    case 'new':
      return 'bg-primary-light text-primary-foreground';
    case 'pending':
      return 'bg-warning-light text-warning-foreground';
    case 'completed':
      return 'bg-medical-light-green text-medical-green';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'Confirmado';
    case 'new':
      return 'Nuevo';
    case 'pending':
      return 'Pendiente';
    case 'completed':
      return 'Completado';
    default:
      return status;
  }
};

export function RecentActivity() {
  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Actividad Reciente
        </CardTitle>
        <CardDescription>
          Últimas acciones realizadas en el sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="p-2 rounded-full bg-primary/10">
              <activity.icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {activity.title}
                </p>
                <Badge variant="secondary" className={getStatusColor(activity.status)}>
                  {getStatusText(activity.status)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {activity.description}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {activity.time}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}