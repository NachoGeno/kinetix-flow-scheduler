import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarClock, MinusCircle } from 'lucide-react';

interface NoShowOptionsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (option: 'reschedule' | 'session_lost', reason?: string) => void;
  patientName: string;
}

export default function NoShowOptionsDialog({ 
  open, 
  onClose, 
  onConfirm, 
  patientName 
}: NoShowOptionsDialogProps) {
  const [selectedOption, setSelectedOption] = useState<'reschedule' | 'session_lost'>('reschedule');
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(selectedOption, reason.trim() || undefined);
    setReason('');
    setSelectedOption('reschedule');
    onClose();
  };

  const handleCancel = () => {
    setReason('');
    setSelectedOption('reschedule');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Paciente no asistió</DialogTitle>
          <DialogDescription>
            {patientName} no asistió a la cita. Selecciona qué acción tomar:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <RadioGroup 
            value={selectedOption} 
            onValueChange={(value) => setSelectedOption(value as 'reschedule' | 'session_lost')}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="reschedule" id="reschedule" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="reschedule" className="cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarClock className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Reprogramar turno</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No se descuenta sesión ni se factura. Se permite agendar un nuevo turno sin costo.
                  </p>
                </Label>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="session_lost" id="session_lost" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="session_lost" className="cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <MinusCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium">Sesión no asistida pero cobrable</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ausente sin justificativo
                  </p>
                </Label>
              </div>
            </div>
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="reason">Observaciones (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Motivo de la inasistencia, comentarios adicionales..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm}
              className="flex-1"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}