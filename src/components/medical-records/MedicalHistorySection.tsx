import { useState, useEffect } from 'react';
import { Calendar, Clock, FileText, Edit, Eye, Plus, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ProgressNoteForm from './ProgressNoteForm';

interface AttendedAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  reason: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  doctor: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
      user_id: string;
    };
    specialty: {
      name: string;
      color: string;
    };
  };
  medical_order?: {
    id: string;
    description: string;
    total_sessions: number;
    sessions_used: number;
  };
  progress_note?: {
    id: string;
    content: string;
    note_type: string;
    status: string;
    attachment_url?: string;
    attachment_name?: string;
    created_at: string;
  };
}

interface MedicalHistorySectionProps {
  patientId: string;
}

export default function MedicalHistorySection({ patientId }: MedicalHistorySectionProps) {
  const [attendedAppointments, setAttendedAppointments] = useState<AttendedAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressNoteForm, setProgressNoteForm] = useState<{
    isOpen: boolean;
    appointmentId?: string;
    patientId?: string;
    medicalOrderId?: string;
    existingNote?: any;
  }>({
    isOpen: false
  });
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (patientId) {
      fetchAttendedAppointments();
    }
  }, [patientId]);

  const fetchAttendedAppointments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          reason,
          diagnosis,
          treatment_plan,
          doctor:doctors(
            id,
            profile:profiles(first_name, last_name, user_id),
            specialty:specialties(name, color)
          ),
          progress_notes(
            id,
            content,
            note_type,
            status,
            attachment_url,
            attachment_name,
            created_at
          )
        `)
        .eq('patient_id', patientId)
        .eq('status', 'completed')
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });

      if (error) throw error;

      // Get medical orders for appointments
      const appointmentIds = data?.map(apt => apt.id) || [];
      let medicalOrdersData: any[] = [];

      if (appointmentIds.length > 0) {
        const { data: ordersData, error: ordersError } = await supabase
          .from('medical_orders')
          .select('id, description, total_sessions, sessions_used, appointment_id')
          .in('appointment_id', appointmentIds);

        if (ordersError) {
          console.error('Error fetching medical orders:', ordersError);
        } else {
          medicalOrdersData = ordersData || [];
        }
      }

      // Combine data
      const combinedData = data?.map(appointment => ({
        ...appointment,
        medical_order: medicalOrdersData.find(order => order.appointment_id === appointment.id),
        progress_note: appointment.progress_notes?.[0] || null
      })) || [];

      setAttendedAppointments(combinedData);
    } catch (error) {
      console.error('Error fetching attended appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los turnos asistidos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canEditProgressNote = (appointment: AttendedAppointment) => {
    if (profile?.role === 'admin') return true;
    if (profile?.role === 'doctor') {
      return appointment.doctor.profile.user_id === profile.user_id;
    }
    return false;
  };

  const handleOpenProgressNoteForm = (appointment: AttendedAppointment) => {
    setProgressNoteForm({
      isOpen: true,
      appointmentId: appointment.id,
      patientId: patientId,
      medicalOrderId: appointment.medical_order?.id,
      existingNote: appointment.progress_note
    });
  };

  const handleCloseProgressNoteForm = () => {
    setProgressNoteForm({ isOpen: false });
  };

  const handleProgressNoteSaved = () => {
    fetchAttendedAppointments();
    handleCloseProgressNoteForm();
  };

  const getProgressNoteTypeIcon = (noteType: string) => {
    switch (noteType) {
      case 'text': return <FileText className="h-4 w-4" />;
      case 'structured': return <FileText className="h-4 w-4" />;
      case 'image': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getProgressNoteTypeLabel = (noteType: string) => {
    switch (noteType) {
      case 'text': return 'Texto libre';
      case 'structured': return 'Formulario estructurado';
      case 'image': return 'Imagen/Archivo';
      default: return noteType;
    }
  };

  // Group appointments by medical order
  const groupedAppointments = attendedAppointments.reduce((groups, appointment) => {
    const orderId = appointment.medical_order?.id || 'sin-orden';
    if (!groups[orderId]) {
      groups[orderId] = [];
    }
    groups[orderId].push(appointment);
    return groups;
  }, {} as Record<string, AttendedAppointment[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p>Cargando historial médico...</p>
        </CardContent>
      </Card>
    );
  }

  if (attendedAppointments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historia Clínica
          </CardTitle>
          <CardDescription>
            Historial de turnos asistidos y evolutivos
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            No hay turnos asistidos registrados para este paciente
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
            <Calendar className="h-5 w-5" />
            Historia Clínica
          </CardTitle>
          <CardDescription>
            Historial cronológico de turnos asistidos y evolutivos agrupados por orden médica
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(groupedAppointments).map(([orderId, appointments]) => (
              <div key={orderId} className="border rounded-lg p-4">
                {/* Medical Order Header */}
                {orderId !== 'sin-orden' && appointments[0].medical_order ? (
                  <div className="mb-4 p-3 bg-muted/50 rounded-md">
                    <h4 className="font-semibold text-lg mb-1">
                      Orden Médica: {appointments[0].medical_order.description}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Sesiones utilizadas: {appointments[0].medical_order.sessions_used} de {appointments[0].medical_order.total_sessions}
                    </p>
                  </div>
                ) : (
                  <div className="mb-4 p-3 bg-muted/50 rounded-md">
                    <h4 className="font-semibold text-lg">
                      Turnos sin orden médica específica
                    </h4>
                  </div>
                )}

                {/* Appointments in this order */}
                <div className="space-y-4">
                  {appointments.map((appointment, index) => (
                    <div key={appointment.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {orderId !== 'sin-orden' ? `Sesión ${index + 1}` : 'Consulta'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(appointment.appointment_date), 'PPP', { locale: es })}
                            </span>
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {appointment.appointment_time}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              Dr. {appointment.doctor.profile.first_name} {appointment.doctor.profile.last_name}
                            </span>
                            <Badge 
                              variant="secondary" 
                              style={{ backgroundColor: appointment.doctor.specialty.color + '20', color: appointment.doctor.specialty.color }}
                            >
                              {appointment.doctor.specialty.name}
                            </Badge>
                          </div>

                          {appointment.reason && (
                            <p className="text-sm text-muted-foreground mb-1">
                              <strong>Motivo:</strong> {appointment.reason}
                            </p>
                          )}
                          
                          {appointment.diagnosis && (
                            <p className="text-sm text-muted-foreground mb-1">
                              <strong>Diagnóstico:</strong> {appointment.diagnosis}
                            </p>
                          )}

                          {appointment.treatment_plan && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Tratamiento:</strong> {appointment.treatment_plan}
                            </p>
                          )}
                        </div>

                        {/* Progress Note Actions */}
                        <div className="ml-4">
                          {appointment.progress_note ? (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenProgressNoteForm(appointment)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver Evolutivo
                              </Button>
                              {canEditProgressNote(appointment) && appointment.progress_note.status === 'draft' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenProgressNoteForm(appointment)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                              )}
                            </div>
                          ) : (
                            canEditProgressNote(appointment) && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenProgressNoteForm(appointment)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Cargar Evolutivo
                              </Button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Progress Note Summary */}
                      {appointment.progress_note && (
                        <>
                          <Separator className="my-3" />
                          <div className="bg-muted/30 p-3 rounded-md">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getProgressNoteTypeIcon(appointment.progress_note.note_type)}
                                <span className="text-sm font-medium">Evolutivo</span>
                                <Badge variant={appointment.progress_note.status === 'final' ? 'default' : 'secondary'}>
                                  {appointment.progress_note.status === 'final' ? 'Final' : 'Borrador'}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(appointment.progress_note.created_at), 'PPp', { locale: es })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {appointment.progress_note.content}
                            </p>
                            {appointment.progress_note.attachment_url && (
                              <p className="text-xs text-muted-foreground mt-1">
                                📎 {appointment.progress_note.attachment_name || 'Archivo adjunto'}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
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
          existingNote={progressNoteForm.existingNote}
          onSave={handleProgressNoteSaved}
          onCancel={handleCloseProgressNoteForm}
          isOpen={progressNoteForm.isOpen}
        />
      )}
    </>
  );
}