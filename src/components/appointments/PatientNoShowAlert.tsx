import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PatientNoShowAlertProps {
  noShowCount: number;
  patientName: string;
  patientId: string;
  variant?: 'default' | 'compact';
  canReset?: boolean;
  onResetClick?: () => void;
  lastResetDate?: string;
  lastResetBy?: string;
}

export default function PatientNoShowAlert({ 
  noShowCount, 
  patientName, 
  patientId,
  variant = 'default',
  canReset = false,
  onResetClick,
  lastResetDate,
  lastResetBy
}: PatientNoShowAlertProps) {
  if (noShowCount < 2) {
    // Show reset info even if no current alerts
    if (lastResetDate && variant === 'default') {
      return (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <RotateCcw className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>✅ Faltas reseteadas:</strong> {lastResetBy} perdonó las inasistencias el {format(new Date(lastResetDate), 'dd/MM/yyyy', { locale: es })}.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  }

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
        <div className="flex items-center justify-between">
          <div>
            <strong>⚠️ Alerta de inasistencias:</strong> {patientName} ya faltó a {noShowCount} turnos sin aviso.
            Se recomienda confirmar asistencia antes de programar nuevas citas.
          </div>
          {canReset && onResetClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetClick}
              className="ml-4 h-8 text-blue-600 hover:text-blue-700 border-blue-300 hover:border-blue-400"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Resetear
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}