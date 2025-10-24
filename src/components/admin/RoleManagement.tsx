import { useState, useEffect } from 'react';
import { Shield, Users, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RoleStats {
  role: string;
  count: number;
  description: string;
  permissions: string[];
}

export default function RoleManagement() {
  const [roleStats, setRoleStats] = useState<RoleStats[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchRoleStats();
  }, []);

  const fetchRoleStats = async () => {
    try {
      setLoading(true);
      
      // Obtener estadísticas de roles desde profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('role');

      if (error) {
        toast({
          title: "Error",
          description: "No se pudieron cargar las estadísticas de roles",
          variant: "destructive",
        });
        return;
      }

      // Contar usuarios por rol
      const roleCounts = data.reduce((acc, profile) => {
        acc[profile.role] = (acc[profile.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Definir información de roles y permisos
      const rolesInfo: RoleStats[] = [
        {
          role: 'gerencia',
          count: roleCounts.gerencia || 0,
          description: 'Acceso administrativo completo excepto gestión de organizaciones',
          permissions: [
            'Gestionar usuarios y roles de la organización',
            'Ver todos los pacientes y doctores',
            'Acceder a facturación y reportes gerenciales',
            'Configurar el sistema de la organización',
            'Gestionar citas y órdenes médicas',
            'Ver historiales clínicos completos',
            'Gestionar presentaciones a obras sociales',
            '❌ NO puede crear nuevas organizaciones'
          ]
        },
        {
          role: 'admin',
          count: roleCounts.admin || 0,
          description: 'Acceso operativo al sistema, gestiona operaciones diarias',
          permissions: [
            'Ver todos los pacientes y doctores',
            'Gestionar citas médicas',
            'Ver historiales clínicos',
            'Gestionar órdenes médicas',
            'Gestionar obras sociales',
            '❌ NO accede a facturación',
            '❌ NO accede a reportes gerenciales',
            '❌ NO accede a configuración del sistema'
          ]
        },
        {
          role: 'doctor',
          count: roleCounts.doctor || 0,
          description: 'Profesional médico con acceso a funciones clínicas',
          permissions: [
            'Ver y gestionar sus pacientes',
            'Gestionar citas médicas',
            'Crear y editar historiales clínicos',
            'Generar órdenes médicas',
            'Ver reportes de sus pacientes',
            'Actualizar su perfil profesional'
          ]
        },
        {
          role: 'patient',
          count: roleCounts.patient || 0,
          description: 'Usuario paciente con acceso limitado a sus datos personales',
          permissions: [
            'Ver sus propias citas',
            'Ver su historial clínico',
            'Ver sus órdenes médicas',
            'Actualizar su información personal',
            'Ver información de doctores',
            'Solicitar citas médicas'
          ]
        }
      ];

      setRoleStats(rolesInfo);
    } catch (error) {
      console.error('Error fetching role stats:', error);
      toast({
        title: "Error",
        description: "Error inesperado al cargar estadísticas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'gerencia':
        return <Shield className="h-6 w-6 text-purple-500" />;
      case 'admin':
        return <Shield className="h-6 w-6 text-red-500" />;
      case 'doctor':
        return <Activity className="h-6 w-6 text-blue-500" />;
      case 'patient':
        return <Users className="h-6 w-6 text-green-500" />;
      default:
        return <Shield className="h-6 w-6" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'gerencia':
        return 'Gerencia';
      case 'admin':
        return 'Administrador';
      case 'doctor':
        return 'Doctor';
      case 'patient':
        return 'Paciente';
      default:
        return role;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'gerencia':
        return 'default';
      case 'admin':
        return 'destructive';
      case 'doctor':
        return 'default';
      case 'patient':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          Cargando información de roles...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestión de Roles y Permisos
          </CardTitle>
          <CardDescription>
            Información sobre los roles del sistema y sus permisos asociados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {roleStats.map((roleInfo) => (
              <Card key={roleInfo.role} className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getRoleIcon(roleInfo.role)}
                      <div>
                        <CardTitle className="text-lg">
                          {getRoleLabel(roleInfo.role)}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={getRoleBadgeVariant(roleInfo.role)}>
                            {roleInfo.count} usuario{roleInfo.count !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {roleInfo.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <div>
                    <h4 className="font-medium mb-3 text-sm">Permisos del rol:</h4>
                    <div className="grid gap-2">
                      {roleInfo.permissions.map((permission, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
                          <span>{permission}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Información importante sobre roles
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Los roles definen el nivel de acceso y las funcionalidades disponibles para cada usuario</li>
              <li>• Solo los administradores pueden cambiar los roles de otros usuarios</li>
              <li>• Los cambios de rol se aplican inmediatamente en el sistema</li>
              <li>• Cada usuario debe tener exactamente un rol asignado</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}