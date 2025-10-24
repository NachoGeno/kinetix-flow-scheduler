import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TimeSlotCellProps {
  slot: {
    status: 'free' | 'occupied' | 'non-working' | 'holiday';
    holidayName?: string;
    appointments?: Array<{
      id: string;
      patientName: string;
      obraSocial: string;
      status: string;
      reason: string | null;
    }>;
  };
  onClickFree: () => void;
  onClickOccupied: () => void;
}

const statusLabels: { [key: string]: string } = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'Asistido',
  completed: 'Completado',
  cancelled: 'Cancelado',
  discharged: 'Dado de Alta',
  rescheduled: 'Reprogramado',
  no_show: 'Ausente',
  no_show_rescheduled: 'Ausente - Reprogramado',
  no_show_session_lost: 'Ausente - Sesión Descontada',
};

const statusColors: { [key: string]: string } = {
  scheduled: 'bg-gradient-to-r from-primary/5 to-primary/10 text-primary border-primary/20 dark:from-primary/10 dark:to-primary/20 dark:text-primary-light dark:border-primary/30',
  confirmed: 'bg-gradient-to-r from-success/5 to-success/10 text-success border-success/20 dark:from-success/10 dark:to-success/20 dark:text-success-light dark:border-success/30',
  in_progress: 'bg-gradient-to-r from-warning/5 to-warning/10 text-warning border-warning/20 dark:from-warning/10 dark:to-warning/20 dark:text-warning-light dark:border-warning/30',
  completed: 'bg-gradient-to-r from-primary/10 to-primary/15 text-primary-dark border-primary/25 dark:from-primary/20 dark:to-primary/30 dark:text-primary-light dark:border-primary/40',
  cancelled: 'bg-gradient-to-r from-destructive/5 to-destructive/10 text-destructive border-destructive/20 dark:from-destructive/10 dark:to-destructive/20 dark:text-destructive-foreground dark:border-destructive/30',
  discharged: 'bg-gradient-to-r from-accent/10 to-accent/20 text-accent-foreground border-accent/30 dark:from-accent/15 dark:to-accent/25 dark:text-accent-foreground dark:border-accent/40',
  no_show: 'bg-gradient-to-r from-muted/50 to-muted text-muted-foreground border-border dark:from-muted dark:to-muted/80 dark:text-muted-foreground dark:border-border',
  rescheduled: 'bg-gradient-to-r from-primary/5 to-primary/10 text-primary border-primary/20 dark:from-primary/10 dark:to-primary/20 dark:text-primary-light dark:border-primary/30',
  no_show_rescheduled: 'bg-gradient-to-r from-warning/5 to-warning/10 text-warning border-warning/20 dark:from-warning/10 dark:to-warning/20 dark:text-warning-light dark:border-warning/30',
  no_show_session_lost: 'bg-gradient-to-r from-destructive/5 to-destructive/10 text-destructive border-destructive/20 dark:from-destructive/10 dark:to-destructive/20 dark:text-destructive-foreground dark:border-destructive/30',
};

export default function TimeSlotCell({ slot, onClickFree, onClickOccupied }: TimeSlotCellProps) {
  if (slot.status === 'holiday') {
    return (
      <div className="h-16 bg-red-50 dark:bg-red-950 flex flex-col items-center justify-center border border-red-200 dark:border-red-800">
        <span className="text-lg">🎊</span>
        <span className="text-[10px] text-red-600 dark:text-red-400 font-medium text-center px-1 leading-tight">
          {slot.holidayName || 'Feriado'}
        </span>
      </div>
    );
  }

  if (slot.status === 'non-working') {
    return (
      <div className="h-16 bg-muted/50 flex items-center justify-center text-muted-foreground text-xs">
        No trabaja
      </div>
    );
  }

  if (slot.status === 'free') {
    return (
      <div
        onClick={onClickFree}
        className="h-16 hover:bg-accent hover:border-2 hover:border-dashed hover:border-primary cursor-pointer transition-all flex items-center justify-center group"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClickFree();
          }
        }}
      >
        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          +
        </span>
      </div>
    );
  }

  // Ocupado - Verificar si hay uno o múltiples turnos
  const appointments = slot.appointments!;
  const isSingleAppointment = appointments.length === 1;

  if (isSingleAppointment) {
    // Mostrar detalles completos como antes
    const appointment = appointments[0];
    const statusColor = statusColors[appointment.status] || 'bg-gray-100 border-gray-300';
    
    return (
      <div
        onClick={onClickOccupied}
        className={cn(
          "h-16 p-1.5 cursor-pointer hover:opacity-80 transition-opacity border flex flex-col justify-between",
          statusColor
        )}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClickOccupied();
          }
        }}
      >
        <div className="text-xs font-medium truncate leading-tight">
          {appointment.patientName}
        </div>
        <div className="text-[10px] text-muted-foreground truncate leading-tight">
          {appointment.obraSocial}
        </div>
        <Badge variant="outline" className="text-[9px] py-0 px-1 h-4 w-fit bg-background/50 border-current">
          {statusLabels[appointment.status] || appointment.status}
        </Badge>
      </div>
    );
  } else {
    // Múltiples turnos - Mostrar contador y lista compacta
    return (
      <div
        onClick={onClickOccupied}
        className="h-16 p-1.5 cursor-pointer hover:opacity-80 transition-opacity border bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-800 flex flex-col gap-1"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClickOccupied();
          }
        }}
      >
        <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
          {appointments.length} turnos
        </div>
        <div className="space-y-0.5 overflow-hidden">
          {appointments.slice(0, 2).map((apt) => (
            <div key={apt.id} className="text-[9px] text-muted-foreground truncate leading-tight">
              • {apt.patientName}
            </div>
          ))}
          {appointments.length > 2 && (
            <div className="text-[9px] text-muted-foreground">
              +{appointments.length - 2} más
            </div>
          )}
        </div>
      </div>
    );
  }
}
