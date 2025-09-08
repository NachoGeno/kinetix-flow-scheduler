import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Building2, Users, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  is_active: boolean;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  max_users: number;
  max_patients: number;
  plan_type: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  created_at: string;
}

interface OrganizationStats {
  id: string;
  total_users: number;
  total_patients: number;
  total_appointments: number;
  active_doctors: number;
}

export function OrganizationManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationStats, setOrganizationStats] = useState<OrganizationStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    max_users: 50,
    max_patients: 1000,
    plan_type: 'basic',
    primary_color: '#3B82F6',
    secondary_color: '#1E40AF'
  });

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las organizaciones",
        variant: "destructive",
      });
    }
  };

  const fetchOrganizationStats = async () => {
    try {
      // Fetch stats for each organization
      const statsPromises = organizations.map(async (org) => {
        const [usersResult, patientsResult, appointmentsResult, doctorsResult] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact' }).eq('organization_id', org.id),
          supabase.from('patients').select('id', { count: 'exact' }).eq('organization_id', org.id),
          supabase.from('appointments').select('id', { count: 'exact' }).eq('organization_id', org.id),
          supabase.from('doctors').select('id', { count: 'exact' }).eq('organization_id', org.id).eq('is_active', true)
        ]);

        return {
          id: org.id,
          total_users: usersResult.count || 0,
          total_patients: patientsResult.count || 0,
          total_appointments: appointmentsResult.count || 0,
          active_doctors: doctorsResult.count || 0
        };
      });

      const stats = await Promise.all(statsPromises);
      setOrganizationStats(stats);
    } catch (error) {
      console.error('Error fetching organization stats:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchOrganizations();
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (organizations.length > 0) {
      fetchOrganizationStats();
    }
  }, [organizations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingOrg) {
        // Update existing organization
        const { error } = await supabase
          .from('organizations')
          .update(formData)
          .eq('id', editingOrg.id);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Organización actualizada correctamente",
        });
      } else {
        // Create new organization
        const { error } = await supabase
          .from('organizations')
          .insert([formData]);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Organización creada correctamente",
        });
      }

      setIsDialogOpen(false);
      setEditingOrg(null);
      resetForm();
      fetchOrganizations();
    } catch (error) {
      console.error('Error saving organization:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la organización",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      subdomain: org.subdomain,
      contact_email: org.contact_email || '',
      contact_phone: org.contact_phone || '',
      address: org.address || '',
      max_users: org.max_users,
      max_patients: org.max_patients,
      plan_type: org.plan_type,
      primary_color: org.primary_color,
      secondary_color: org.secondary_color
    });
    setIsDialogOpen(true);
  };

  const handleToggleActive = async (orgId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ is_active: !currentStatus })
        .eq('id', orgId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: `Organización ${!currentStatus ? 'activada' : 'desactivada'} correctamente`,
      });

      fetchOrganizations();
    } catch (error) {
      console.error('Error updating organization status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la organización",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      subdomain: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      max_users: 50,
      max_patients: 1000,
      plan_type: 'basic',
      primary_color: '#3B82F6',
      secondary_color: '#1E40AF'
    });
  };

  const getStats = (orgId: string) => {
    return organizationStats.find(stat => stat.id === orgId) || {
      total_users: 0,
      total_patients: 0,
      total_appointments: 0,
      active_doctors: 0
    };
  };

  if (loading) {
    return <div className="p-6">Cargando organizaciones...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Organizaciones</h2>
          <p className="text-muted-foreground">Administra todas las organizaciones del sistema SaaS</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingOrg(null); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Organización
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingOrg ? 'Editar Organización' : 'Nueva Organización'}
              </DialogTitle>
              <DialogDescription>
                {editingOrg ? 'Modifica los datos de la organización' : 'Crea una nueva organización en el sistema'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="subdomain">Subdominio *</Label>
                  <Input
                    id="subdomain"
                    value={formData.subdomain}
                    onChange={(e) => setFormData(prev => ({ ...prev, subdomain: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_email">Email de Contacto</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="contact_phone">Teléfono</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Dirección</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="max_users">Máximo Usuarios</Label>
                  <Input
                    id="max_users"
                    type="number"
                    value={formData.max_users}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_users: parseInt(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="max_patients">Máximo Pacientes</Label>
                  <Input
                    id="max_patients"
                    type="number"
                    value={formData.max_patients}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_patients: parseInt(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label htmlFor="plan_type">Tipo de Plan</Label>
                  <Select value={formData.plan_type} onValueChange={(value) => setFormData(prev => ({ ...prev, plan_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Básico</SelectItem>
                      <SelectItem value="professional">Profesional</SelectItem>
                      <SelectItem value="enterprise">Empresarial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingOrg ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {organizations.map((org) => {
          const stats = getStats(org.id);
          return (
            <Card key={org.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {org.name}
                      <Badge variant={org.is_active ? "default" : "secondary"}>
                        {org.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {org.subdomain} • Plan {org.plan_type}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={org.is_active}
                        onCheckedChange={() => handleToggleActive(org.id, org.is_active)}
                      />
                      <Label>Activa</Label>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(org)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Users className="h-4 w-4 text-blue-500 mr-1" />
                      <span className="text-2xl font-bold">{stats.total_users}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Usuarios</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Activity className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-2xl font-bold">{stats.total_patients}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Pacientes</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Building2 className="h-4 w-4 text-purple-500 mr-1" />
                      <span className="text-2xl font-bold">{stats.active_doctors}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Doctores</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Users className="h-4 w-4 text-orange-500 mr-1" />
                      <span className="text-2xl font-bold">{stats.total_appointments}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Citas</p>
                  </div>
                </div>
                
                {org.contact_email && (
                  <div className="text-sm text-muted-foreground">
                    <strong>Contacto:</strong> {org.contact_email}
                    {org.contact_phone && ` • ${org.contact_phone}`}
                  </div>
                )}
                
                <div className="text-sm text-muted-foreground mt-2">
                  <strong>Límites:</strong> {stats.total_users}/{org.max_users} usuarios • {stats.total_patients}/{org.max_patients} pacientes
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}