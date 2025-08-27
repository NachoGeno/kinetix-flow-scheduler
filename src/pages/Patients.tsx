import { useState, useEffect } from 'react';
import { Search, Plus, Users, Phone, Mail, Calendar, IdCard, Trash2, Edit } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PatientForm from '@/components/patients/PatientForm';

interface Patient {
  id: string;
  profile_id: string;
  medical_record_number: string;
  blood_type: string;
  insurance_provider: string;
  insurance_number: string;
  profile: {
    first_name: string;
    last_name: string;
    dni: string;
    email: string;
    phone: string;
    date_of_birth: string;
    avatar_url: string;
  };
}

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPatients();
  }, [profile]);

  const fetchPatients = async () => {
    if (!profile || profile.role === 'patient') return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('patients')
        .select(`
          *,
          profile_id,
          profile:profiles(
            first_name,
            last_name,
            dni,
            email,
            phone,
            date_of_birth,
            avatar_url
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "Error",
          description: "No se pudieron cargar los pacientes",
          variant: "destructive",
        });
        return;
      }

      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePatient = async (patientId: string) => {
    try {
      // Verificar si el paciente tiene citas completadas antes de eliminar
      const { data: completedAppointments, error: checkError } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', patientId)
        .eq('status', 'completed')
        .limit(1);

      if (checkError) {
        console.error('Error checking appointments:', checkError);
      }

      const hasCompletedSessions = (completedAppointments || []).length > 0;

      const { error } = await supabase
        .from('patients')
        .update({ is_active: false })
        .eq('id', patientId);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo eliminar el paciente",
          variant: "destructive",
        });
        return;
      }

      // Mensaje personalizado según si tenía sesiones completadas o no
      const message = hasCompletedSessions 
        ? "Paciente eliminado. Sus turnos activos se mantienen debido a sesiones completadas previas."
        : "Paciente eliminado. Todos sus turnos programados han sido cancelados automáticamente.";

      toast({
        title: "Éxito",
        description: message,
      });
      
      fetchPatients(); // Recargar la lista
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el paciente",
        variant: "destructive",
      });
    }
  };

  const filteredPatients = patients.filter(patient => {
    const searchLower = searchTerm.toLowerCase();
    return (
      patient.profile?.first_name?.toLowerCase().includes(searchLower) ||
      patient.profile?.last_name?.toLowerCase().includes(searchLower) ||
      patient.profile?.email?.toLowerCase().includes(searchLower) ||
      patient.profile?.dni?.toLowerCase().includes(searchLower) ||
      patient.medical_record_number?.toLowerCase().includes(searchLower)
    );
  });

  // Redirect if patient tries to access this page
  if (profile?.role === 'patient') {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold mb-4">Acceso no autorizado</h1>
        <p className="text-muted-foreground">No tienes permisos para ver esta página.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Pacientes</h1>
        </div>
        <div className="text-center py-8">Cargando pacientes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pacientes</h1>
          <p className="text-muted-foreground">
            Total: {filteredPatients.length} pacientes
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Paciente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogTitle className="sr-only">Nuevo Paciente</DialogTitle>
            <DialogDescription className="sr-only">
              Formulario para crear un nuevo paciente en el sistema
            </DialogDescription>
            <PatientForm
              onSuccess={() => {
                setDialogOpen(false);
                fetchPatients();
              }}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog para editar paciente */}
      <Dialog open={!!editingPatient} onOpenChange={(open) => !open && setEditingPatient(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Editar Paciente</DialogTitle>
          <DialogDescription className="sr-only">
            Formulario para editar la información del paciente
          </DialogDescription>
          {editingPatient && (
            <PatientForm
              patient={editingPatient}
              isEditing={true}
              onSuccess={() => {
                setEditingPatient(null);
                fetchPatients();
              }}
              onCancel={() => setEditingPatient(null)}
            />
          )}
        </DialogContent>
        </Dialog>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar pacientes por nombre, DNI, email o número de historia..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Patients Grid */}
      <div className="grid gap-6">
        {filteredPatients.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No se encontraron pacientes' : 'No hay pacientes registrados'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPatients.map((patient) => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={patient.profile?.avatar_url} />
                    <AvatarFallback>
                      {patient.profile?.first_name?.[0]}{patient.profile?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-xl">
                      {patient.profile?.first_name} {patient.profile?.last_name}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Historia Clínica: {patient.medical_record_number || 'No asignado'}
                    </CardDescription>
                    {patient.blood_type && (
                      <Badge variant="outline" className="mt-2">
                        Tipo de sangre: {patient.blood_type}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {patient.profile?.dni && (
                    <div className="flex items-center space-x-2">
                      <IdCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">DNI: {patient.profile.dni}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{patient.profile?.email}</span>
                  </div>
                  {patient.profile?.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{patient.profile.phone}</span>
                    </div>
                  )}
                  {patient.profile?.date_of_birth && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {(() => {
                          try {
                            return format(new Date(patient.profile.date_of_birth), 'PPP', { locale: es });
                          } catch {
                            return patient.profile.date_of_birth;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                  {patient.insurance_provider && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Obra Social:</span>
                      <span className="text-sm">{patient.insurance_provider}</span>
                    </div>
                  )}
                  {patient.insurance_number && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">N° Afiliado:</span>
                      <span className="text-sm">{patient.insurance_number}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button variant="outline" size="sm">
                    Ver Historia
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditingPatient(patient)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button size="sm">
                    Ver Detalles
                  </Button>
                  {profile?.role === 'admin' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                           <AlertDialogDescription>
                             Esta acción desactivará al paciente {patient.profile?.first_name} {patient.profile?.last_name}. 
                             El paciente ya no aparecerá en la lista activa pero se mantendrán sus registros históricos.
                             <br /><br />
                             <strong>Importante:</strong> Si el paciente no ha asistido a sesiones previas (no tiene citas completadas), 
                             todos sus turnos programados se cancelarán automáticamente. Si ya asistió a sesiones, 
                             sus turnos se mantendrán activos.
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeletePatient(patient.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}