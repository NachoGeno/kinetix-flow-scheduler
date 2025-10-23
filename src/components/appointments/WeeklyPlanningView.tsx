import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Stethoscope, AlertCircle } from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useWeeklyAppointments } from '@/hooks/useWeeklyAppointments';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import WeeklyStatsBar from './WeeklyStatsBar';
import WeeklyFilters from './WeeklyFilters';
import WeeklyAppointmentCard from './WeeklyAppointmentCard';

export default function WeeklyPlanningView() {
  const { profile } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>();
  const [selectedObraSocialId, setSelectedObraSocialId] = useState<string>();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDayAppointments, setSelectedDayAppointments] = useState<any[]>([]);
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ doctor: string; date: string }>({ doctor: '', date: '' });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1, locale: es });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1, locale: es });

  const { data: weeklyData, isLoading, error } = useWeeklyAppointments({
    weekStartDate: currentWeek,
    doctorId: selectedDoctorId,
    obraSocialId: selectedObraSocialId,
    statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
  });

  // Obtener lista de doctores
  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors', 'active'],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('doctors')
        .select('id, profile:profiles(first_name, last_name), specialty:specialties(name, color)')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('profile(first_name)');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  // Obtener lista de obras sociales
  const { data: obrasSociales = [] } = useQuery({
    queryKey: ['obras_sociales', 'active'],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('obras_sociales_art')
        .select('id, nombre')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('nombre');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

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

  const handleClearFilters = () => {
    setSelectedDoctorId(undefined);
    setSelectedObraSocialId(undefined);
    setSelectedStatuses([]);
  };

  const handleCellClick = (doctorName: string, date: Date, appointments: any[]) => {
    if (appointments.length === 0) return;
    setSelectedDayInfo({
      doctor: doctorName,
      date: format(date, "EEEE d 'de' MMMM", { locale: es })
    });
    setSelectedDayAppointments(appointments);
    setDetailsOpen(true);
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
      {/* Navegación de semana */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousWeek}
                className="border-border"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-center">
                <CardTitle className="text-xl text-foreground flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  {format(weekStart, "d 'de' MMMM", { locale: es })} - {format(weekEnd, "d 'de' MMMM 'de' yyyy", { locale: es })}
                </CardTitle>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={handleNextWeek}
                className="border-border"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" onClick={handleToday} className="border-border">
              Hoy
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Filtros */}
      <WeeklyFilters
        doctors={doctors}
        obrasSociales={obrasSociales}
        selectedDoctorId={selectedDoctorId}
        selectedObraSocialId={selectedObraSocialId}
        selectedStatuses={selectedStatuses}
        onDoctorChange={setSelectedDoctorId}
        onObraSocialChange={setSelectedObraSocialId}
        onStatusesChange={setSelectedStatuses}
        onClearFilters={handleClearFilters}
      />

      {/* Estadísticas */}
      {!isLoading && weeklyData && (
        <WeeklyStatsBar
          totalAppointments={weeklyData.totalAppointments}
          statusCounts={weeklyData.statusCounts}
        />
      )}

      {/* Grilla semanal */}
      <Card className="border-border">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : weeklyData && Object.keys(weeklyData.appointmentsByDoctor).length > 0 ? (
            <div className="space-y-6">
              {Object.values(weeklyData.appointmentsByDoctor).map((doctorData: any) => (
                <div key={doctorData.doctorId} className="space-y-3">
                  {/* Encabezado del doctor */}
                  <div className="flex items-center gap-3 pb-2 border-b border-border">
                    <Stethoscope 
                      className="h-5 w-5 flex-shrink-0" 
                      style={{ color: doctorData.specialtyColor }}
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{doctorData.doctorName}</h3>
                      <p className="text-sm text-muted-foreground">{doctorData.specialty}</p>
                    </div>
                  </div>

                  {/* Grilla de días */}
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const appointments = doctorData.appointmentsByDay[dateKey] || [];
                      const hasAppointments = appointments.length > 0;

                      return (
                        <div
                          key={dateKey}
                          className={`
                            p-3 rounded-lg border transition-all
                            ${hasAppointments 
                              ? 'border-primary/30 bg-primary/5 hover:bg-primary/10 cursor-pointer' 
                              : 'border-border bg-muted/30'}
                          `}
                          onClick={() => handleCellClick(doctorData.doctorName, day, appointments)}
                        >
                          <div className="text-center">
                            <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                              {format(day, 'EEE', { locale: es })}
                            </div>
                            <div className="text-sm font-medium text-foreground mb-1">
                              {format(day, 'd', { locale: es })}
                            </div>
                            {hasAppointments ? (
                              <Badge 
                                variant="secondary" 
                                className="w-full justify-center bg-primary/20 text-primary border-primary/30"
                              >
                                {appointments.length}
                              </Badge>
                            ) : (
                              <div className="text-xs text-muted-foreground">-</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg text-foreground mb-2">
                No hay turnos para mostrar
              </h3>
              <p className="text-muted-foreground">
                {selectedDoctorId || selectedObraSocialId || selectedStatuses.length > 0
                  ? 'Intenta cambiar los filtros para ver más resultados.'
                  : 'No se encontraron turnos para esta semana.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalles */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedDayInfo.doctor} - {selectedDayInfo.date}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {selectedDayAppointments.map((apt) => (
              <WeeklyAppointmentCard key={apt.id} appointment={apt} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
