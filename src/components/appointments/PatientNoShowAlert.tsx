import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface PatientNoShowAlertProps {
  noShowCount: number;
  patientName: string;
  variant?: 'default' | 'compact';
}

export default function PatientNoShowAlert({ 
  noShowCount, 
  patientName, 
  variant = 'default' 
}: PatientNoShowAlertProps) {
  if (noShowCount < 2) return null;

  if (variant === 'compact') {
    return (
      <Badge variant="destructive" className="flex items-center gap-1 text-xs">
        <AlertTriangle className="h-3 w-3" />
        {noShowCount} faltas
      </Badge>
    );
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <strong>⚠️ Alerta de inasistencias:</strong> {patientName} ya faltó a {noShowCount} turnos sin aviso.
        Se recomienda confirmar asistencia antes de programar nuevas citas.
      </AlertDescription>
    </Alert>
  );
}