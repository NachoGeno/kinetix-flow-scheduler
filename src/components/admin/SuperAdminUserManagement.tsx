import { useState } from 'react';
import { Search, Edit2, Users, Shield, Stethoscope, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSuperAdminUsers } from '@/hooks/useSuperAdminUsers';
import { useOrganizations } from '@/hooks/useOrganizations';
import { format } from 'date-fns';

export default function SuperAdminUserManagement() {
  const { users, loading, updateUserRole, createUser } = useSuperAdminUsers();
  const { organizations } = useOrganizations();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'patient',
    organization_id: ''
  });

  const filteredUsers = users.filter(user =>
    user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.organization_name && user.organization_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'destructive';
      case 'gerencia':
        return 'default';
      case 'admin':
        return 'default';
      case 'doctor':
        return 'secondary';
      case 'reception':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'gerencia':
        return 'Gerencia';
      case 'admin':
        return 'Administrador';
      case 'doctor':
        return 'Doctor';
      case 'reception':
        return 'Recepción';
      case 'patient':
        return 'Paciente';
      default:
        return role;
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setIsEditDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (editingUser && selectedRole) {
      const success = await updateUserRole(editingUser.profile_id, selectedRole);
      if (success) {
        setIsEditDialogOpen(false);
        setEditingUser(null);
        setSelectedRole('');
      }
    }
  };

  const handleCreateUser = async () => {
    if (newUser.first_name && newUser.last_name && newUser.email && newUser.password && newUser.organization_id) {
      const success = await createUser(newUser);
      if (success) {
        setIsCreateDialogOpen(false);
        resetCreateForm();
      }
    }
  };

  const resetCreateForm = () => {
    setNewUser({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      role: 'patient',
      organization_id: ''
    });
  };

  const getStats = () => {
    return {
      totalUsers: users.length,
      superAdmins: users.filter(user => user.role === 'super_admin').length,
      gerencias: users.filter(user => user.role === 'gerencia').length,
      admins: users.filter(user => user.role === 'admin').length,
      doctors: users.filter(user => user.role === 'doctor').length,
      reception: users.filter(user => user.role === 'reception').length,
    };
  };

  const stats = getStats();

  if (loading) {
    return <div className="p-6">Cargando usuarios...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gestión de Usuarios del Sistema
            </CardTitle>
            <CardDescription>
              Administra usuarios de todas las organizaciones del sistema
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Usuario
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, rol u organización..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <div className="text-sm text-muted-foreground">Total Usuarios</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">{stats.superAdmins}</div>
            <div className="text-sm text-muted-foreground">Super Admins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.gerencias}</div>
            <div className="text-sm text-muted-foreground">Gerencias</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.admins}</div>
            <div className="text-sm text-muted-foreground">Admins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">{stats.doctors}</div>
            <div className="text-sm text-muted-foreground">Doctores</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.reception}</div>
            <div className="text-sm text-muted-foreground">Recepción</div>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-4">
          {filteredUsers.map((user) => (
            <div
              key={user.profile_id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
            >
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback>
                    {user.first_name[0]}{user.last_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Organización: {user.organization_name || 'Sin organización'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Creado: {format(new Date(user.created_at), 'dd/MM/yyyy')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {getRoleLabel(user.role)}
                </Badge>
                <Dialog open={isEditDialogOpen && editingUser?.profile_id === user.profile_id} onOpenChange={setIsEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUser(user)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Usuario</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <strong>Nombre:</strong> {editingUser?.first_name} {editingUser?.last_name}
                      </div>
                      <div>
                        <strong>Email:</strong> {editingUser?.email}
                      </div>
                      <div>
                        <strong>Organización:</strong> {editingUser?.organization_name || 'Sin organización'}
                      </div>
                      <div>
                        <label className="text-sm font-medium">Rol:</label>
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar rol" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="gerencia">Gerencia</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="doctor">Doctor</SelectItem>
                            <SelectItem value="reception">Recepción</SelectItem>
                            <SelectItem value="patient">Paciente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleUpdateRole} className="w-full">
                        Guardar Cambios
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron usuarios que coincidan con la búsqueda.
          </div>
        )}
        
        {/* Create User Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Nombre</Label>
                  <Input
                    id="first_name"
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                    placeholder="Ingrese el nombre"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Apellido</Label>
                  <Input
                    id="last_name"
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                    placeholder="Ingrese el apellido"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Ingrese el email"
                />
              </div>

              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Ingrese la contraseña"
                />
              </div>

              <div>
                <Label htmlFor="organization">Organización</Label>
                <Select
                  value={newUser.organization_id}
                  onValueChange={(value) => setNewUser({ ...newUser, organization_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar organización" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="role">Rol</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="gerencia">Gerencia</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="reception">Recepción</SelectItem>
                    <SelectItem value="patient">Paciente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateUser} className="flex-1">
                  Crear Usuario
                </Button>
                <Button variant="outline" onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetCreateForm();
                }} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}