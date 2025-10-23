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
  no_show: 'Ausente',
};

const statusColors: { [key: string]: string } = {
  scheduled: 'bg-primary/10 text-primary border-primary/20',
  confirmed: 'bg-success/10 text-success border-success/20',
  in_progress: 'bg-warning/10 text-warning border-warning/20',
  completed: 'bg-primary/20 text-primary-dark border-primary/30',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  no_show: 'bg-muted text-muted-foreground border-border',
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
