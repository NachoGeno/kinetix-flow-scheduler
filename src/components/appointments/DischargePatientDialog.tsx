
import { useState } from 'react';
import { UserCheck, AlertTriangle, Calendar, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PatientInfo {
  id: string;
  name: string;
  totalSessions: number;
  usedSessions: number;
  futureAppointments: Array<{
    id: string;
    appointment_date: string;
    appointment_time: string;
    doctor_name: string;
  }>;
  medicalOrderId: string;
}

interface DischargePatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientInfo: PatientInfo | null;
  onSuccess: () => void;
}

export default function DischargePatientDialog({
  open,
  onOpenChange,
  patientInfo,
  onSuccess,
}: DischargePatientDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [reason, setReason] = useState('');
  const { toast } = useToast();

  const handleDischarge = async () => {
    if (!patientInfo || !reason.trim()) {
      toast({
        title: "Error",
        description: "Por favor, ingrese el motivo del alta temprana",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Cancelar todos los turnos futuros y marcarlos como "discharged"
      const appointmentIds = patientInfo.futureAppointments.map(apt => apt.id);
      
      if (appointmentIds.length > 0) {
        const { error: appointmentsError } = await supabase
          .from('appointments')
          .update({ 
            status: 'discharged',
            notes: `Alta temprana: ${reason}`,
            updated_at: new Date().toISOString()
          })
          .in('id', appointmentIds);

        if (appointmentsError) throw appointmentsError;
      }

      // 2. Marcar la orden médica como completada con alta temprana
      const { error: orderError } = await supabase
        .from('medical_orders')
        .update({
          early_discharge: true, // Marcar PRIMERO como alta temprana
          completed: true,
          completed_at: new Date().toISOString(),
          sessions_used: patientInfo.usedSessions,
          results: `Alta temprana: ${reason}. Sesiones completadas: ${patientInfo.usedSessions}/${patientInfo.totalSessions}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', patientInfo.medicalOrderId);

      if (orderError) throw orderError;

      // 3. Crear entrada en unified_medical_histories si no existe
      const { data: existingHistory } = await supabase
        .from('unified_medical_histories')
        .select('id, template_data')
        .eq('medical_order_id', patientInfo.medicalOrderId)
        .maybeSingle();

      const dischargeInfo = {
        discharge_summary: {
          discharge_date: new Date().toISOString(),
          reason: reason,
          sessions_completed: patientInfo.usedSessions,
          total_sessions: patientInfo.totalSessions,
          early_discharge: true,
          cancelled_appointments: appointmentIds.length
        }
      };

      if (existingHistory) {
        // Actualizar historia existente
        const currentTemplateData = existingHistory.template_data && typeof existingHistory.template_data === 'object' 
          ? existingHistory.template_data 
          : {};
        const updatedTemplateData = {
          ...currentTemplateData,
          ...dischargeInfo
        };

        const { error: historyError } = await supabase
          .from('unified_medical_histories')
          .update({
            template_data: updatedTemplateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingHistory.id);

        if (historyError) throw historyError;
      } else {
        // Crear nueva historia
        const { error: historyError } = await supabase
          .from('unified_medical_histories')
          .insert({
            medical_order_id: patientInfo.medicalOrderId,
            patient_id: patientInfo.id,
            template_data: dischargeInfo
          });

        if (historyError) throw historyError;
      }

      toast({
        title: "Alta temprana procesada",
        description: `Se han cancelado ${appointmentIds.length} citas y se completó la orden médica con ${patientInfo.usedSessions}/${patientInfo.totalSessions} sesiones`,
      });

      setReason('');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error processing discharge:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar el alta temprana",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!patientInfo) return null;

  const remainingSessions = patientInfo.totalSessions - patientInfo.usedSessions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Alta Temprana de Paciente
          </DialogTitle>
          <DialogDescription>
            Procesar alta antes de completar todas las sesiones programadas
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Información del paciente */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Información del Paciente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Paciente</Label>
                  <p className="text-lg font-semibold">{patientInfo.name}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Sesiones Completadas</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-sm">
                        {patientInfo.usedSessions} / {patientInfo.totalSessions}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Sesiones Restantes</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm">
                        {remainingSessions} sesiones
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Citas afectadas */}
            {patientInfo.futureAppointments.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Citas que se Cancelarán ({patientInfo.futureAppointments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {patientInfo.futureAppointments.map((appointment) => (
                      <div key={appointment.id} className="flex justify-between items-center p-2 border rounded-lg">
                        <div>
                          <p className="font-medium">
                            {format(new Date(appointment.appointment_date), 'dd MMM yyyy', { locale: es })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {appointment.appointment_time} - {appointment.doctor_name}
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          Se cancelará
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Advertencia */}
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-800">
                  Advertencia: Esta acción no se puede deshacer
                </p>
                <p className="text-sm text-yellow-700">
                  • Se cancelarán {patientInfo.futureAppointments.length} citas futuras
                  <br />
                  • La orden médica se marcará como completada con {patientInfo.usedSessions} de {patientInfo.totalSessions} sesiones
                  <br />
                  • Los turnos cancelados estarán disponibles para otros pacientes
                </p>
              </div>
            </div>

            {/* Motivo del alta */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">
                Motivo del Alta Temprana *
              </Label>
              <Textarea
                id="reason"
                placeholder="Explique el motivo del alta temprana (ej: mejoría clínica, abandono del tratamiento, derivación, etc.)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
        </ScrollArea>

        {/* Botones */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDischarge}
            disabled={isProcessing || !reason.trim()}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isProcessing ? (
              <>Procesando...</>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Alta Temprana
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
