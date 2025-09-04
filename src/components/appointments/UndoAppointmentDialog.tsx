import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UndoAppointmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: {
    id: string;
    status: string;
    patient: {
      profile: {
        first_name: string;
        last_name: string;
      };
    };
  };
  onSuccess: () => void;
}

export default function UndoAppointmentDialog({
  isOpen,
  onClose,
  appointment,
  onSuccess
}: UndoAppointmentDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getStatusLabel = (status: string) => {
    const labels = {
      'completed': 'asistencia',
      'no_show': 'inasistencia',
      'no_show_session_lost': 'inasistencia con descuento',
      'cancelled': 'cancelación'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getRevertConsequences = (status: string) => {
    switch (status) {
      case 'completed':
        return 'El turno volverá al estado "Programado". Si se creó historia clínica, deberá revisarse manualmente.';
      case 'no_show_session_lost':
        return 'Se restaurará la sesión descontada en la orden médica. Si la orden se completó debido a esta sesión, se revertirá su estado de completado.';
      case 'no_show':
        return 'El turno volverá al estado "Programado".';
      case 'cancelled':
        return 'El turno volverá al estado "Programado".';
      default:
        return 'El turno volverá al estado "Programado".';
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Debe ingresar un motivo para la reversión"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('revert_appointment_status', {
        appointment_uuid: appointment.id,
        revert_reason_text: reason.trim()
      });

      if (error) throw error;

      toast({
        title: "Acción revertida",
        description: `La ${getStatusLabel(appointment.status)} ha sido revertida exitosamente.`
      });

      onSuccess();
      onClose();
      setReason('');
    } catch (error: any) {
      console.error('Error reverting appointment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo revertir la acción"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setReason('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            Deshacer Acción
          </DialogTitle>
          <DialogDescription>
            ¿Está seguro que desea revertir la {getStatusLabel(appointment.status)} del paciente{' '}
            <strong>
              {appointment.patient?.profile?.first_name} {appointment.patient?.profile?.last_name}
            </strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Consecuencias:</strong><br />
              {getRevertConsequences(appointment.status)}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo de la reversión <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ingrese el motivo por el cual está revirtiendo esta acción..."
              className="min-h-[80px]"
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
          >
            {loading ? "Revirtiendo..." : "Confirmar Reversión"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}