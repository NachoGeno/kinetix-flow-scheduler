import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, Stethoscope } from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useDoctorWeeklySchedule } from '@/hooks/useDoctorWeeklySchedule';
import { useDoctors } from '@/hooks/useDoctors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TimeSlotCell from './TimeSlotCell';
import CreateAppointmentDialog from './CreateAppointmentDialog';
import WeeklyAppointmentCard from './WeeklyAppointmentCard';
import { useQueryClient } from '@tanstack/react-query';

export default function WeeklyPlanningView() {
  const queryClient = useQueryClient();
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

  const handleCreateAppointment = (date: Date, time: string) => {
    setSelectedSlot({ date, time });
    setCreateDialogOpen(true);
  };

  const handleViewDetails = (appointment: any) => {
    setSelectedAppointment(appointment);
    setDetailsDialogOpen(true);
  };

  const handleCreateSuccess = () => {
    // Invalidar cache para refrescar la vista
    queryClient.invalidateQueries({ 
      queryKey: ['doctor-weekly-schedule', selectedDoctorId] 
    });
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
                                onClickFree={() => handleCreateAppointment(dayData.date, time)}
                                onClickOccupied={() => handleViewDetails(slot.appointment)}
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
          <DialogHeader>
            <DialogTitle className="text-foreground">Detalles del Turno</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Paciente</p>
                  <p className="font-medium text-foreground">{selectedAppointment.patientName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Obra Social</p>
                  <p className="font-medium text-foreground">{selectedAppointment.obraSocial}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="font-medium text-foreground capitalize">{selectedAppointment.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duración</p>
                  <p className="font-medium text-foreground">{selectedAppointment.duration_minutes} min</p>
                </div>
              </div>
              {selectedAppointment.reason && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Motivo</p>
                  <p className="text-sm text-foreground">{selectedAppointment.reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
