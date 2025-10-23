import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TimeSlotCellProps {
  slot: {
    status: 'free' | 'occupied' | 'non-working';
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
  no_show: 'Ausente',
};

const statusColors: { [key: string]: string } = {
  confirmed: 'bg-green-100 border-green-300 dark:bg-green-950 dark:border-green-800',
  scheduled: 'bg-yellow-100 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-800',
  in_progress: 'bg-blue-100 border-blue-300 dark:bg-blue-950 dark:border-blue-800',
  completed: 'bg-blue-100 border-blue-300 dark:bg-blue-950 dark:border-blue-800',
  cancelled: 'bg-gray-100 border-gray-300 dark:bg-gray-900 dark:border-gray-700',
  no_show: 'bg-red-100 border-red-300 dark:bg-red-950 dark:border-red-800',
};

export default function TimeSlotCell({ slot, onClickFree, onClickOccupied }: TimeSlotCellProps) {
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
