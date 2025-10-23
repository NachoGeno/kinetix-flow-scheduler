import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, Stethoscope, CheckCircle } from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDoctorWeeklySchedule } from '@/hooks/useDoctorWeeklySchedule';
import { useDoctors } from '@/hooks/useDoctors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TimeSlotCell from './TimeSlotCell';
import CreateAppointmentDialog from './CreateAppointmentDialog';
import WeeklyAppointmentCard from './WeeklyAppointmentCard';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnifiedMedicalHistory } from '@/hooks/useUnifiedMedicalHistory';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// Colores y etiquetas del sistema para estados de citas
const statusColors = {
  scheduled: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light border-primary/20',
  confirmed: 'bg-success/10 text-success dark:bg-success/20 dark:text-success-light border-success/20',
  in_progress: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning-light border-warning/20',
  completed: 'bg-primary/20 text-primary-dark dark:bg-primary/30 dark:text-primary-light border-primary/30',
  cancelled: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground border-destructive/20',
  no_show: 'bg-muted text-muted-foreground dark:bg-muted border-muted',
  no_show_rescheduled: 'bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning-light border-warning/30',
  no_show_session_lost: 'bg-warning/15 text-warning dark:bg-warning/25 dark:text-warning-light border-warning/25',
};

const statusLabels: { [key: string]: string } = {
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  in_progress: 'En Progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'Ausente',
  no_show_rescheduled: 'Ausente - Reprogramado',
  no_show_session_lost: 'Ausente - Sesión Perdida',
};

export default function WeeklyPlanningView() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { createOrUpdateMedicalHistoryEntry } = useUnifiedMedicalHistory();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: Date;
    time: string;
  } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1, locale: es });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1, locale: es });

  // Obtener datos del doctor seleccionado
  const { data: scheduleData, isLoading, error } = useDoctorWeeklySchedule(selectedDoctorId, currentWeek);
  
  // Obtener lista de doctores
  const { data: doctorsData = [], isLoading: isLoadingDoctors } = useDoctors();
  const doctors = doctorsData as any[];

  // Generar días de la semana
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
  };

  const handleCreateAppointment = (date: Date, time: string, slot?: any) => {
    // Prevenir creación de turnos en feriados
    if (slot?.status === 'holiday') {
      toast.error(`No se pueden crear turnos en ${slot.holidayName || 'días feriados'}`);
      return;
    }

    setSelectedSlot({ date, time });
    setCreateDialogOpen(true);
  };

  const handleViewDetails = (appointments: any) => {
    if (Array.isArray(appointments)) {
      // Múltiples turnos
      setSelectedAppointment({ multiple: true, appointments });
    } else {
      // Turno único (compatibilidad backward)
      setSelectedAppointment({ multiple: false, appointment: appointments });
    }
    setDetailsDialogOpen(true);
  };

  const handleCreateSuccess = () => {
    // Invalidar cache para refrescar la vista
    queryClient.invalidateQueries({ 
      queryKey: ['doctor-weekly-schedule', selectedDoctorId] 
    });
  };

  const handleMarkAttendance = async (appointmentId: string, appointmentData: any) => {
    if (!profile) return;

    try {
      // Actualizar estado del turno a "completed"
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (appointmentError) throw appointmentError;

      // Buscar orden médica asociada
      const { data: medicalOrderData, error: orderError } = await supabase
        .from('medical_orders')
        .select('id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (orderError) {
        console.error('Error fetching medical order:', orderError);
      }

      // Crear/actualizar entrada en historial médico
      await createOrUpdateMedicalHistoryEntry(
        appointmentId,
        medicalOrderData?.id || null,
        appointmentData.patient_id,
        selectedDoctorId!,
        scheduleData?.doctor?.name || 'Doctor',
        appointmentData.appointment_date
      );

      toast.success('Paciente marcado como presente y sesión completada');

      // Refrescar datos y cerrar modal
      queryClient.invalidateQueries({ 
        queryKey: ['doctor-weekly-schedule', selectedDoctorId] 
      });
      setDetailsDialogOpen(false);
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast.error('No se pudo marcar la asistencia');
    }
  };

  if (error) {
    return (
      <Card className="border-border">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="font-semibold text-lg text-foreground">Error al cargar los turnos</h3>
              <p className="text-muted-foreground mt-2">
                Hubo un problema al obtener los turnos de la semana.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navegación de semana y selector de profesional */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col gap-4">
            {/* Selector de profesional */}
            <div className="flex items-center gap-3">
              <Stethoscope className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Select
                  value={selectedDoctorId}
                  onValueChange={setSelectedDoctorId}
                >
                  <SelectTrigger className="w-full border-border">
                    <SelectValue placeholder="Seleccione un profesional para ver su agenda" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover">
                    {isLoadingDoctors ? (
                      <div className="p-2 text-sm text-muted-foreground">Cargando...</div>
                    ) : doctors.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No hay profesionales activos</div>
                    ) : (
                      doctors.map((doctor: any) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: doctor.specialty?.color || '#3B82F6' }}
                            />
                            <span className="font-medium">{doctor.name}</span>
                            <span className="text-xs text-muted-foreground">
                              - {doctor.specialty?.name || 'Sin especialidad'}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Navegación de semanas */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePreviousWeek}
                  className="border-border"
                  disabled={!selectedDoctorId}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  {format(weekStart, "d 'de' MMMM", { locale: es })} - {format(weekEnd, "d 'de' MMMM 'de' yyyy", { locale: es })}
                </CardTitle>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextWeek}
                  className="border-border"
                  disabled={!selectedDoctorId}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button 
                variant="outline" 
                onClick={handleToday} 
                className="border-border"
                disabled={!selectedDoctorId}
              >
                Hoy
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Grid de horarios */}
      {!selectedDoctorId ? (
        <Card className="border-border">
          <CardContent className="p-12">
            <div className="text-center">
              <Stethoscope className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Seleccione un profesional
              </h3>
              <p className="text-muted-foreground">
                Para ver la agenda semanal detallada, seleccione un profesional del menú superior.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-border">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg text-foreground">Error al cargar la agenda</h3>
                <p className="text-muted-foreground mt-2">
                  Hubo un problema al obtener los horarios del profesional.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : scheduleData ? (
        <Card className="border-border">
          <CardContent className="p-6">
            {/* Header con info del doctor */}
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: scheduleData.doctor?.specialtyColor }}
              />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{scheduleData.doctor?.name}</h3>
                <p className="text-sm text-muted-foreground">{scheduleData.doctor?.specialty}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                Turnos de {scheduleData.doctor?.appointmentDuration} min
              </div>
            </div>

            {/* Grid de horarios */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-border p-2 bg-muted/30 min-w-[80px] sticky left-0 z-10">
                      <span className="text-sm font-medium text-muted-foreground">Horario</span>
                    </th>
                    {Object.entries(scheduleData.weekSchedule).map(([dateKey, dayData]: [string, any]) => (
                      <th key={dateKey} className="border border-border p-2 bg-primary/5 min-w-[120px]">
                        <div className="text-center">
                          <div className="font-semibold text-foreground text-sm">
                            {format(dayData.date, 'EEE', { locale: es })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(dayData.date, 'dd/MM')}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.timeSlots.map((time: string) => (
                    <tr key={time}>
                      <td className="border border-border p-2 bg-muted/30 font-medium text-center text-sm sticky left-0 z-10">
                        {time}
                      </td>
                      {Object.entries(scheduleData.weekSchedule).map(([dateKey, dayData]: [string, any]) => {
                        const slot = dayData.slots.find((s: any) => s.time === time);
                        return (
                          <td key={`${dateKey}-${time}`} className="border border-border p-0">
                            {slot && (
                              <TimeSlotCell
                                slot={slot}
                                onClickFree={() => handleCreateAppointment(dayData.date, time, slot)}
                                onClickOccupied={() => handleViewDetails(slot.appointments)}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Modal para crear turno */}
      {selectedSlot && scheduleData?.doctor && (
        <CreateAppointmentDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          doctorId={selectedDoctorId!}
          doctorName={scheduleData.doctor.name}
          date={selectedSlot.date}
          time={selectedSlot.time}
          appointmentDuration={scheduleData.doctor.appointmentDuration}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Modal de detalles de turno */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg border-border">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-xl font-bold text-foreground">
              {selectedAppointment?.multiple ? 
                `🗓️ ${selectedAppointment.appointments.length} Turnos en este horario` : 
                '📋 Detalles del Turno'
              }
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedAppointment?.multiple ? (
              // Lista de múltiples turnos
              <div className="space-y-3 mt-4 max-h-96 overflow-y-auto pr-2">
                {selectedAppointment.appointments.map((apt: any) => {
                  const statusColor = statusColors[apt.status as keyof typeof statusColors] || 
                    'bg-gray-100 text-gray-700 border-gray-200';
                  const statusLabel = statusLabels[apt.status as keyof typeof statusLabels] || apt.status;
                  
                  return (
                    <div 
                      key={apt.id} 
                      className="p-4 border-2 border-border rounded-xl hover:shadow-md transition-all duration-200 bg-card"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground mb-1">
                            {apt.patientName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {apt.obraSocial}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs font-medium px-3 py-1", statusColor)}
                        >
                          {statusLabel}
                        </Badge>
                      </div>
                      
                      {apt.reason && (
                        <div className="bg-muted/30 rounded-lg p-2 mb-3">
                          <p className="text-[10px] uppercase text-muted-foreground font-medium mb-0.5">
                            Motivo
                          </p>
                          <p className="text-sm text-foreground">
                            {apt.reason}
                          </p>
                        </div>
                      )}

                      {(apt.status === 'scheduled' || apt.status === 'confirmed') && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <Button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAttendance(apt.id, apt);
                            }}
                            size="sm"
                            className="w-full font-medium"
                            variant="default"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Marcar Presente
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // Turno único
              <div className="space-y-4 mt-4">
                <div className="flex items-start justify-between pb-4 border-b border-border">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground mb-1">
                      {selectedAppointment?.appointment?.patientName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedAppointment?.appointment?.obraSocial}
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs font-medium px-3 py-1.5",
                      statusColors[selectedAppointment?.appointment?.status as keyof typeof statusColors] || 
                      'bg-gray-100 text-gray-700 border-gray-200'
                    )}
                  >
                    {statusLabels[selectedAppointment?.appointment?.status as keyof typeof statusLabels] || 
                     selectedAppointment?.appointment?.status}
                  </Badge>
                </div>

                {selectedAppointment?.appointment?.reason && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs uppercase text-muted-foreground font-medium mb-1">
                      Motivo de la consulta
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {selectedAppointment.appointment.reason}
                    </p>
                  </div>
                )}

                {(selectedAppointment?.appointment?.status === 'scheduled' || 
                  selectedAppointment?.appointment?.status === 'confirmed') && (
                  <div className="pt-4 border-t border-border">
                    <Button 
                      onClick={() => handleMarkAttendance(
                        selectedAppointment.appointment.id,
                        selectedAppointment.appointment
                      )}
                      className="w-full font-medium"
                      variant="default"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Marcar Presente
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
