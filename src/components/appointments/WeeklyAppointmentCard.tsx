import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, User, Building2 } from 'lucide-react';
import { format } from 'date-fns';

interface AppointmentData {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string | null;
  patient: {
    profile: {
      first_name: string;
      last_name: string;
    } | null;
    obra_social_art: {
      nombre: string;
    } | null;
  } | null;
}

interface WeeklyAppointmentCardProps {
  appointment: AppointmentData;
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

export default function WeeklyAppointmentCard({ appointment }: WeeklyAppointmentCardProps) {
  const patientName = appointment.patient?.profile
    ? `${appointment.patient.profile.first_name} ${appointment.patient.profile.last_name}`
    : 'Sin paciente';

  const obraSocial = appointment.patient?.obra_social_art?.nombre || 'Particular';

  return (
    <Card className="border-border hover:bg-accent/5 transition-colors">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-foreground text-sm">
              {format(new Date(`2000-01-01T${appointment.appointment_time}`), 'HH:mm')}
            </span>
          </div>
          <Badge 
            variant="outline" 
            className={`text-xs ${statusColors[appointment.status] || 'bg-muted text-muted-foreground'}`}
          >
            {statusLabels[appointment.status] || appointment.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-foreground truncate">{patientName}</span>
        </div>

        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground truncate">{obraSocial}</span>
        </div>

        {appointment.reason && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {appointment.reason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
