import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserManagement from '@/components/admin/UserManagement';
import RoleManagement from '@/components/admin/RoleManagement';
import EmailSettingsForm from '@/components/email/EmailSettingsForm';
import { Shield, Users, Settings as SettingsIcon } from 'lucide-react';

export default function Configuration() {
  const { profile } = useAuth();

  // Verificar que el usuario sea administrador
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center space-y-4 p-6">
            <Shield className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">Acceso Restringido</h2>
              <p className="text-sm text-muted-foreground">
                Solo los administradores pueden acceder a esta sección
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Gestión de Usuarios
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Gestión de Roles
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UserManagement />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <RoleManagement />
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          {/* Email Settings */}
          <EmailSettingsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}