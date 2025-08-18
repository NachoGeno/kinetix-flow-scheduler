import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ResetNoShowDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId: string;
  patientName: string;
  currentNoShowCount: number;
}

export default function ResetNoShowDialog({ 
  open, 
  onClose, 
  onSuccess, 
  patientId, 
  patientName,
  currentNoShowCount
}: ResetNoShowDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  const handleReset = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      // Get all no-show appointments for this patient
      const { data: noShowAppointments, error: fetchError } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', patientId)
        .in('status', ['no_show', 'no_show_rescheduled', 'no_show_session_lost'])
        .is('pardoned_by', null);

      if (fetchError) throw fetchError;

      const appointmentCount = noShowAppointments?.length || 0;

      if (appointmentCount === 0) {
        toast({
          title: "Sin inasistencias",
          description: "Este paciente no tiene inasistencias pendientes para perdonar.",
          variant: "destructive",
        });
        return;
      }

      // Pardon all no-show appointments
      const { error: pardonError } = await supabase
        .from('appointments')
        .update({
          pardoned_by: profile.id,
          pardoned_at: new Date().toISOString(),
          pardon_reason: reason.trim() || 'Reseteo de contador de inasistencias'
        })
        .eq('patient_id', patientId)
        .in('status', ['no_show', 'no_show_rescheduled', 'no_show_session_lost'])
        .is('pardoned_by', null);

      if (pardonError) throw pardonError;

      // Create audit log entry
      const { error: auditError } = await supabase
        .from('patient_noshow_resets')
        .insert({
          patient_id: patientId,
          reset_by: profile.id,
          reason: reason.trim() || 'Reseteo de contador de inasistencias',
          appointments_affected: appointmentCount
        });

      if (auditError) throw auditError;

      toast({
        title: "Éxito",
        description: `Se perdonaron ${appointmentCount} inasistencias para ${patientName}`,
      });

      setReason('');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error resetting no-shows:', error);
      toast({
        title: "Error",
        description: "No se pudo resetear el contador de inasistencias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-blue-600" />
            Resetear contador de inasistencias
          </DialogTitle>
          <DialogDescription>
            Se van a perdonar las inasistencias de <strong>{patientName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Inasistencias actuales: {currentNoShowCount}</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Esta acción perdonará todas las inasistencias no perdonadas previamente y reiniciará el contador a 0.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-reason">Motivo del reseteo</Label>
            <Textarea
              id="reset-reason"
              placeholder="Ejemplo: Paciente justificó las faltas por motivos médicos..."
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
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleReset}
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Procesando...' : 'Resetear contador'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}