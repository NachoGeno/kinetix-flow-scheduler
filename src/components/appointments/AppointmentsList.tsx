import { useState, useEffect } from 'react';
import { Calendar, Clock, Search, Plus, Filter, Trash2, CheckCircle, UserCheck, UserX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AppointmentForm from './AppointmentForm';

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string;
  patient: {
    profile: {
      first_name: string;
      last_name: string;
    };
  };
  doctor: {
    profile: {
      first_name: string;
      last_name: string;
    };
    specialty: {
      name: string;
      color: string;
    };
  };
}

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
};

const statusLabels = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  in_progress: 'En Progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No Asistió',
};

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchAppointments();
  }, [profile]);

  const fetchAppointments = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(
            profile:profiles(first_name, last_name)
          ),
          doctor:doctors(
            profile:profiles(first_name, last_name),
            specialty:specialties(name, color)
          )
        `)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      // Filter based on user role
      if (profile.role === 'patient') {
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('profile_id', profile.id)
          .single();
        
        if (patientData) {
          query = query.eq('patient_id', patientData.id);
        }
      } else if (profile.role === 'doctor') {
        const { data: doctorData } = await supabase
          .from('doctors')
          .select('id')
          .eq('profile_id', profile.id)
          .single();
        
        if (doctorData) {
          query = query.eq('doctor_id', doctorData.id);
        }
      }

      const { data, error } = await query;

      if (error) {
        toast({
          title: "Error",
          description: "No se pudieron cargar las citas",
          variant: "destructive",
        });
        return;
      }

      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAppointmentCreated = () => {
    fetchAppointments();
    setIsNewAppointmentOpen(false);
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      // Cancelar la cita
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Cita cancelada correctamente",
      });

      fetchAppointments();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la cita",
        variant: "destructive",
      });
    }
  };

  const handleMarkAttendance = async (appointmentId: string, status: 'completed' | 'no_show') => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId);

      if (error) throw error;

      const statusMessages = {
        completed: 'Paciente marcado como asistido - Historia habilitada para cerrar',
        no_show: 'Paciente marcado como no asistió'
      };

      toast({
        title: "Éxito",
        description: statusMessages[status],
      });

      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la cita",
        variant: "destructive",
      });
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = appointment.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.patient?.profile?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.patient?.profile?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.doctor?.profile?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         appointment.doctor?.profile?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Citas Médicas</h1>
        </div>
        <div className="text-center py-8">Cargando citas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Lista de Citas</h1>
        {profile?.role === 'patient' && (
          <Dialog open={isNewAppointmentOpen} onOpenChange={setIsNewAppointmentOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Cita
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Agendar Nueva Cita</DialogTitle>
              </DialogHeader>
              <AppointmentForm onSuccess={handleAppointmentCreated} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar citas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="scheduled">Programada</SelectItem>
            <SelectItem value="confirmed">Confirmada</SelectItem>
            <SelectItem value="in_progress">En Progreso</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
            <SelectItem value="no_show">No Asistió</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Appointments List */}
      <div className="grid gap-4">
        {filteredAppointments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron citas</p>
            </CardContent>
          </Card>
        ) : (
          filteredAppointments.map((appointment) => (
            <Card key={appointment.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {profile?.role === 'patient' 
                        ? `Dr. ${appointment.doctor?.profile?.first_name} ${appointment.doctor?.profile?.last_name}`
                        : `${appointment.patient?.profile?.first_name} ${appointment.patient?.profile?.last_name}`
                      }
                    </CardTitle>
                    <CardDescription>
                      {appointment.doctor?.specialty?.name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={statusColors[appointment.status as keyof typeof statusColors]}
                      variant="secondary"
                    >
                      {statusLabels[appointment.status as keyof typeof statusLabels]}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {/* Botones de asistencia para doctores y admins */}
                      {(profile?.role === 'doctor' || profile?.role === 'admin') && 
                       appointment.status === 'scheduled' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-green-600 hover:text-green-700"
                            onClick={() => handleMarkAttendance(appointment.id, 'completed')}
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            Asistió
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-gray-600 hover:text-gray-700"
                            onClick={() => handleMarkAttendance(appointment.id, 'no_show')}
                          >
                            <UserX className="h-3 w-3 mr-1" />
                            No asistió
                          </Button>
                        </>
                      )}
                      
                      {/* Botón cancelar */}
                      {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Cancelar cita?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción cancelará la cita programada. El horario quedará disponible para otros pacientes. ¿Estás seguro de que deseas continuar?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleCancelAppointment(appointment.id)}
                              >
                                Sí, cancelar cita
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {format(new Date(appointment.appointment_date), 'PPP', { locale: es })}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {appointment.appointment_time}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: appointment.doctor?.specialty?.color }}
                    />
                    <span className="text-sm">
                      {appointment.doctor?.specialty?.name}
                    </span>
                  </div>
                </div>
                {appointment.reason && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>Motivo:</strong> {appointment.reason}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}