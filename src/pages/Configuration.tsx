import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserManagement from '@/components/admin/UserManagement';
import RoleManagement from '@/components/admin/RoleManagement';
import EmailSettingsForm from '@/components/email/EmailSettingsForm';
import HolidaysManagement from '@/components/configuration/HolidaysManagement';
import { Shield, Users, Settings as SettingsIcon, Building2, Calendar } from 'lucide-react';

export default function Configuration() {
  const { profile } = useAuth();

  // Verificar que el usuario sea administrador, super_admin o gerencia
  if (!profile || !['admin', 'super_admin', 'gerencia'].includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center space-y-4 p-6">
            <Shield className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">Acceso Restringido</h2>
              <p className="text-sm text-muted-foreground">
                Solo administradores y gerencia pueden acceder a esta sección
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Configuración del Sistema
        </h1>
        <p className="text-muted-foreground">
          Gestión de usuarios, roles y permisos del sistema
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="holidays" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Feriados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UserManagement />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <RoleManagement />
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <EmailSettingsForm />
        </TabsContent>

        <TabsContent value="holidays" className="space-y-4">
          <HolidaysManagement />
        </TabsContent>
      </Tabs>

      {/* Panel SaaS para Super Admin */}
      {profile?.role === 'super_admin' && (
        <Card className="mt-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Building2 className="h-5 w-5" />
              Panel Super Admin - Sistema SaaS
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Accede al panel de administración global para gestionar todas las organizaciones del sistema multiempresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <a href="/saas-admin">
                <Building2 className="mr-2 h-4 w-4" />
                Ir al Panel SaaS
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}