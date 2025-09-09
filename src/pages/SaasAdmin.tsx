import { useAuth } from '@/hooks/useAuth';
import { OrganizationManagement } from '@/components/admin/OrganizationManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Building2, Users, Activity, TrendingUp } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SystemStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalUsers: number;
  totalPatients: number;
  totalAppointments: number;
}

export default function SaasAdmin() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<SystemStats>({
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalUsers: 0,
    totalPatients: 0,
    totalAppointments: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchSystemStats = async () => {
    try {
      // Fetch organizations
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('*');

      if (orgsError) throw orgsError;

      // Fetch aggregated statistics
      const { data: statsData, error: statsError } = await supabase.rpc('get_organization_statistics');

      if (statsError) throw statsError;

      // Calculate totals
      const totalOrganizations = orgsData?.length || 0;
      const activeOrganizations = orgsData?.filter(org => org.is_active).length || 0;
      
      const totals = statsData?.reduce((acc: any, stat: any) => ({
        totalUsers: acc.totalUsers + parseInt(stat.total_users),
        totalPatients: acc.totalPatients + parseInt(stat.total_patients),
        totalAppointments: acc.totalAppointments + parseInt(stat.total_appointments)
      }), { totalUsers: 0, totalPatients: 0, totalAppointments: 0 }) || {};

      setStats({
        totalOrganizations,
        activeOrganizations,
        totalUsers: totals.totalUsers || 0,
        totalPatients: totals.totalPatients || 0,
        totalAppointments: totals.totalAppointments || 0
      });
    } catch (error) {
      console.error('Error fetching system stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      fetchSystemStats();
    }
  }, [profile]);

  // Solo super_admin puede acceder a esta página
  if (!profile || profile.role !== 'super_admin') {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center space-y-4 p-6">
            <Shield className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">Acceso Restringido</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Esta sección está disponible solo para Super Administradores del sistema.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Rol actual: {profile?.role || 'No autenticado'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Panel SaaS - Super Admin</h1>
          <p className="text-muted-foreground">Administración central del sistema multiempresa</p>
        </div>
      </div>

      {/* Dashboard Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizaciones Activas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : stats.activeOrganizations}</div>
            <p className="text-xs text-muted-foreground">Clientes del sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Usuarios en todas las organizaciones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pacientes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '-' : stats.totalPatients}</div>
            <p className="text-xs text-muted-foreground">Pacientes registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crecimiento Mensual</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+0%</div>
            <p className="text-xs text-muted-foreground">Nuevas organizaciones este mes</p>
          </CardContent>
        </Card>
      </div>

      {/* Organization Management */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Organizaciones</CardTitle>
          <CardDescription>
            Administra todas las organizaciones registradas en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationManagement />
        </CardContent>
      </Card>
    </div>
  );
}