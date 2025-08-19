import { Bell, Search, User, LogOut, MessageCircle, Calendar, Clock } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useNovedadesToday } from "@/hooks/useNovedades";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export function Header() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: novedadesHoy = [] } = useNovedadesToday();

  const getCategoryColor = (categoria: string) => {
    switch (categoria) {
      case "tecnica": return "text-blue-600";
      case "administrativa": return "text-gray-600";
      case "medica": return "text-green-600";
      case "urgente": return "text-red-600";
      default: return "text-gray-600";
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
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="h-8 w-8" />
      </div>

      <div className="flex items-center gap-4">
        {/* Notificaciones de Novedades */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {novedadesHoy.length > 0 && (
                <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground text-xs">
                  {novedadesHoy.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <DropdownMenuLabel className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Novedades de Hoy
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {novedadesHoy.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay novedades para hoy</p>
              </div>
            ) : (
              <>
                {novedadesHoy.slice(0, 5).map((novedad) => (
                  <DropdownMenuItem 
                    key={novedad.id} 
                    className="flex-col items-start p-3 cursor-pointer hover:bg-accent"
                    onClick={() => navigate("/novedades")}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${getCategoryColor(novedad.categoria)}`}>
                          {novedad.categoria.charAt(0).toUpperCase() + novedad.categoria.slice(1)}
                        </span>
                        <span className="text-xs">{getShiftIcon(novedad.turno)}</span>
                        {novedad.urgente && (
                          <Badge className="bg-red-600 text-white text-xs px-1">¡URGENTE!</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(novedad.created_at), "HH:mm")}
                      </div>
                    </div>
                    <p className="text-sm text-left line-clamp-2 w-full">
                      {novedad.contenido}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Por: {novedad.profiles 
                        ? `${novedad.profiles.first_name} ${novedad.profiles.last_name}`
                        : "Usuario desconocido"}
                    </p>
                  </DropdownMenuItem>
                ))}
                
                {novedadesHoy.length > 5 && (
                  <DropdownMenuSeparator />
                )}
                
                <DropdownMenuItem 
                  className="text-center text-primary hover:text-primary-foreground hover:bg-primary cursor-pointer"
                  onClick={() => navigate("/novedades")}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Ver todas las novedades ({novedadesHoy.length})
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Perfil de usuario */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback>
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <div className="text-sm font-medium">
                  {profile?.first_name} {profile?.last_name}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {profile?.role === 'patient' ? 'Paciente' : 
                   profile?.role === 'doctor' ? 'Doctor' : 'Administrador'}
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Bell className="mr-2 h-4 w-4" />
              Notificaciones
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}