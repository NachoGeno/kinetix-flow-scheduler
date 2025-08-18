import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Calendar, User, AlertTriangle } from "lucide-react";

interface Novedad {
  id: string;
  contenido: string;
  fecha: string;
  turno: "mañana" | "tarde" | "completo";
  categoria: "tecnica" | "administrativa" | "medica" | "urgente";
  urgente: boolean;
  created_at: string;
  autor_id: string;
  profiles?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface NovedadesListProps {
  novedades: Novedad[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function NovedadesList({ novedades, isLoading }: NovedadesListProps) {
  const getCategoryColor = (categoria: string) => {
    switch (categoria) {
      case "tecnica": return "bg-blue-100 text-blue-800 border-blue-200";
      case "administrativa": return "bg-gray-100 text-gray-800 border-gray-200";
      case "medica": return "bg-green-100 text-green-800 border-green-200";
      case "urgente": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getShiftIcon = (turno: string) => {
    switch (turno) {
      case "mañana": return "🌅";
      case "tarde": return "🌆";
      case "completo": return "🌞";
      default: return "🌞";
    }
  };

  const getShiftLabel = (turno: string) => {
    switch (turno) {
      case "mañana": return "Mañana";
      case "tarde": return "Tarde";
      case "completo": return "Día completo";
      default: return "Día completo";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!novedades.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            📝
          </div>
          <h3 className="text-lg font-medium mb-2">No hay novedades</h3>
          <p className="text-muted-foreground">
            No se encontraron novedades que coincidan con los filtros seleccionados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {novedades.map((novedad) => (
        <Card key={novedad.id} className={`transition-all hover:shadow-md ${novedad.urgente ? 'ring-2 ring-red-200' : ''}`}>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Header with categories and urgent badge */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={getCategoryColor(novedad.categoria)}
                  >
                    {novedad.categoria.charAt(0).toUpperCase() + novedad.categoria.slice(1)}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <span>{getShiftIcon(novedad.turno)}</span>
                    {getShiftLabel(novedad.turno)}
                  </Badge>
                  {novedad.urgente && (
                    <Badge className="bg-red-600 text-white flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      ¡URGENTE!
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(novedad.created_at), "HH:mm", { locale: es })}
                </div>
              </div>

              {/* Content */}
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground whitespace-pre-wrap">{novedad.contenido}</p>
              </div>

              {/* Footer with author and date */}
              <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>
                      {novedad.profiles 
                        ? `${novedad.profiles.first_name} ${novedad.profiles.last_name}`
                        : "Usuario desconocido"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {format(new Date(novedad.fecha), "dd 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>
                </div>
                {novedad.urgente && (
                  <div className="text-red-600 font-medium text-xs">
                    Requiere atención inmediata
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}