import { useState } from 'react';
import { AlertTriangle, Calendar, Clock, User, Plus, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ProgressNoteForm from '@/components/medical-records/ProgressNoteForm';

interface PendingAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  reason: string | null;
  patient_id: string;
  patient: {
    profile: {
      first_name: string;
      last_name: string;
    };
  };
  medical_order?: {
    id: string;
    description: string;
    total_sessions: number;
    sessions_used: number;
  };
}

export default function PendingProgressNotes() {
  const [progressNoteForm, setProgressNoteForm] = useState<{
    isOpen: boolean;
    appointmentId?: string;
    patientId?: string;
    medicalOrderId?: string;
  }>({
    isOpen: false
  });
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingAppointments = [], isLoading: loading } = useQuery({
    queryKey: ['pending-progress-notes', profile?.id],
    queryFn: async (): Promise<PendingAppointment[]> => {
      if (!profile?.id) return [];

      // Get doctor profile
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (doctorError || !doctorData) {
        console.error('Error fetching doctor data:', doctorError);
        return [];
      }

      // Get completed appointments without progress notes (optimized with joins)
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          reason,
          patient_id,
          patient:patients(
            profile:profiles(first_name, last_name)
          ),
          progress_notes!left(id),
          medical_orders!left(
            id,
            description,
            total_sessions,
            sessions_used
          )
        `)
        .eq('doctor_id', doctorData.id)
        .eq('status', 'in_progress')
        .is('progress_notes.id', null)
        .order('appointment_date', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      // Transform data to match interface
      return appointmentsData?.map(appointment => ({
        ...appointment,
        medical_order: appointment.medical_orders?.[0] || undefined
      })) || [];
    },
    enabled: !!profile?.id && profile?.role === 'doctor',
    staleTime: 30 * 1000, // 30 seconds - this data should be fresh
    gcTime: 2 * 60 * 1000, // 2 minutes cache
  });

  const handleOpenProgressNoteForm = (appointment: PendingAppointment) => {
    setProgressNoteForm({
      isOpen: true,
      appointmentId: appointment.id,
      patientId: appointment.patient_id,
      medicalOrderId: appointment.medical_order?.id
    });
  };

  const handleCloseProgressNoteForm = () => {
    setProgressNoteForm({ isOpen: false });
  };

  const handleProgressNoteSaved = () => {
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['pending-progress-notes'] });
    queryClient.invalidateQueries({ queryKey: ['recent-activity'] });
    
    handleCloseProgressNoteForm();
    toast({
      title: "Éxito",
      description: "Evolutivo guardado correctamente",
    });
  };

  // Don't show for non-doctors
  if (profile?.role !== 'doctor') {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-4">
          <p className="text-sm text-muted-foreground">Cargando turnos pendientes...</p>
        </CardContent>
      </Card>
    );
  }

  if (pendingAppointments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <Eye className="h-5 w-5" />
            Evolutivos Pendientes
          </CardTitle>
          <CardDescription>
            No tienes turnos pendientes de cargar evolutivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            ¡Excelente! Todos tus turnos asistidos tienen evolutivo cargado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Evolutivos Pendientes
            <Badge variant="destructive">
              {pendingAppointments.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Turnos asistidos que requieren carga de evolutivo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Tenés {pendingAppointments.length} evoluciones pendientes</strong> de cargar.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {pendingAppointments.map((appointment) => (
              <div key={appointment.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {appointment.patient.profile.first_name} {appointment.patient.profile.last_name}
                      </span>
                      {appointment.medical_order && (
                        <Badge variant="outline" className="text-xs">
                          Sesión {appointment.medical_order.sessions_used}/{appointment.medical_order.total_sessions}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {format(new Date(appointment.appointment_date), 'PPP', { locale: es })}
                      </span>
                      <Clock className="h-3 w-3 ml-2" />
                      <span>{appointment.appointment_time}</span>
                    </div>

                    {appointment.medical_order && (
                      <p className="text-sm text-muted-foreground mb-1">
                        <strong>Orden:</strong> {appointment.medical_order.description}
                      </p>
                    )}

                    {appointment.reason && (
                      <p className="text-sm text-muted-foreground">
                        <strong>Motivo:</strong> {appointment.reason}
                      </p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={() => handleOpenProgressNoteForm(appointment)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Cargar Evolutivo
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Progress Note Form */}
      {progressNoteForm.isOpen && (
        <ProgressNoteForm
          appointmentId={progressNoteForm.appointmentId!}
          patientId={progressNoteForm.patientId!}
          medicalOrderId={progressNoteForm.medicalOrderId}
          existingNote={null}
          onSave={handleProgressNoteSaved}
          onCancel={handleCloseProgressNoteForm}
          isOpen={progressNoteForm.isOpen}
        />
      )}
    </>
  );
}