import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, UserPlus, CalendarPlus, FileText, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const quickActions = [
  {
    title: "Nuevo Paciente",
    description: "Registrar un paciente en el sistema",
    icon: UserPlus,
    href: "/patients",
    variant: "default" as const,
  },
  {
    title: "Agendar Turno",
    description: "Programar una nueva cita",
    icon: CalendarPlus,
    href: "/appointments",
    variant: "secondary" as const,
  },
  {
    title: "Cargar Orden",
    description: "Subir orden médica",
    icon: FileText,
    href: "/orders",
    variant: "outline" as const,
  },
  {
    title: "Ver Historias",
    description: "Acceder a registros médicos",
    icon: BarChart3,
    href: "/medical-records",
    variant: "outline" as const,
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  const handleActionClick = (href: string) => {
    navigate(href);
  };

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
      <CardContent className="grid grid-cols-2 gap-3">
        {quickActions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            className="h-20 p-3 flex flex-col items-center justify-center gap-2 hover:shadow-soft transition-all duration-200 text-center"
            onClick={() => handleActionClick(action.href)}
          >
            <action.icon className="w-5 h-5 flex-shrink-0" />
            <div className="flex flex-col items-center gap-1">
              <span className="font-medium text-sm leading-tight">{action.title}</span>
              <span className="text-xs opacity-70 leading-tight text-center max-w-full overflow-hidden">
                {action.description}
              </span>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}