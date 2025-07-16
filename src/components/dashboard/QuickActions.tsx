import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, UserPlus, CalendarPlus, FileText, BarChart3 } from "lucide-react";

const quickActions = [
  {
    title: "Nuevo Paciente",
    description: "Registrar un paciente en el sistema",
    icon: UserPlus,
    href: "/pacientes/nuevo",
    variant: "default" as const,
  },
  {
    title: "Agendar Turno",
    description: "Programar una nueva cita",
    icon: CalendarPlus,
    href: "/calendario/nuevo",
    variant: "secondary" as const,
  },
  {
    title: "Cargar Orden",
    description: "Subir orden médica",
    icon: FileText,
    href: "/ordenes/nueva",
    variant: "outline" as const,
  },
  {
    title: "Ver Informes",
    description: "Generar reportes",
    icon: BarChart3,
    href: "/informes",
    variant: "outline" as const,
  },
];

export function QuickActions() {
  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Acciones Rápidas
        </CardTitle>
        <CardDescription>
          Atajos para las tareas más comunes
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {quickActions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            className="h-auto p-4 flex flex-col items-start gap-2 hover:shadow-soft transition-all duration-200"
            onClick={() => {
              // TODO: Navigate to action.href
              console.log(`Navigate to ${action.href}`);
            }}
          >
            <div className="flex items-center gap-2 w-full">
              <action.icon className="w-5 h-5" />
              <span className="font-medium">{action.title}</span>
            </div>
            <span className="text-xs text-left opacity-70">
              {action.description}
            </span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}