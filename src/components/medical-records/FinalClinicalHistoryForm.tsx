import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Calendar, User, Save, FileSignature, Download, Upload, X, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MedicalOrder {
  id: string;
  description: string;
  total_sessions: number;
  sessions_used: number;
  order_type: string;
  completed: boolean;
}

interface AppointmentSession {
  id: string;
  appointment_date: string;
  appointment_time: string;
  professional_name: string;
  professional_id: string;
  observations: string | null;
  evolution: string | null;
  status: string;
}

interface FinalClinicalHistoryFormProps {
  medicalOrderId: string;
  patientId: string;
  onSave?: () => void;
  trigger?: React.ReactNode;
}

export function FinalClinicalHistoryForm({ 
  medicalOrderId, 
  patientId, 
  onSave,
  trigger 
}: FinalClinicalHistoryFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [medicalOrder, setMedicalOrder] = useState<MedicalOrder | null>(null);
  const [sessions, setSessions] = useState<AppointmentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<{url: string, name: string} | null>(null);
  const [allSessionsCompleted, setAllSessionsCompleted] = useState(false);
  
  // Final summary form data
  const [finalSummary, setFinalSummary] = useState({
    initial_assessment: '',
    treatment_objectives: '',
    sessions_summary: '',
    patient_evolution: '',
    final_recommendations: '',
    treatment_outcome: '',
    discharge_notes: '',
    evolution_file_url: '',
    evolution_file_name: ''
  });

  useEffect(() => {
    if (isOpen && medicalOrderId) {
      fetchMedicalOrderData();
    }
  }, [isOpen, medicalOrderId]);

  const fetchMedicalOrderData = async () => {
    try {
      setLoading(true);

      // Fetch medical order details
      const { data: orderData, error: orderError } = await supabase
        .from('medical_orders')
        .select('*')
        .eq('id', medicalOrderId)
        .single();

      if (orderError) throw orderError;
      setMedicalOrder(orderData);

      // Check if all sessions are completed by comparing total vs completed appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          doctor:doctors!appointments_doctor_id_fkey(
            profile:profiles!doctors_profile_id_fkey(
              first_name,
              last_name,
              id
            )
          )
        `)
        .eq('patient_id', patientId)
        .order('appointment_date', { ascending: true });

      if (appointmentsError) throw appointmentsError;

      // Check if all required sessions are completed (including in_progress as valid)
      const completedSessions = appointmentsData?.filter(apt => 
        apt.status === 'completed' || apt.status === 'in_progress'
      ) || [];
      const completedCount = completedSessions.length;
      
      console.log('Debug - Order:', orderData);
      console.log('Debug - Total sessions needed:', orderData.total_sessions);
      console.log('Debug - Appointments data:', appointmentsData);
      console.log('Debug - Completed sessions count:', completedCount);
      console.log('Debug - Order completed:', orderData.completed);
      
      setAllSessionsCompleted(completedCount >= orderData.total_sessions || orderData.completed);

      // Get completed and in_progress appointments for display
      const completedAppointments = appointmentsData?.filter(apt => 
        apt.status === 'completed' || apt.status === 'in_progress'
      ) || [];

      if (appointmentsError) throw appointmentsError;

        // Get medical history entries for these appointments from the specific medical order
        const { data: unifiedHistoryData, error: historyError } = await supabase
          .from('unified_medical_histories')
          .select(`
            id,
            medical_history_entries(
              appointment_id,
              professional_name,
              professional_id,
              observations,
              evolution
            )
          `)
          .eq('medical_order_id', medicalOrderId)
          .single();

        let sessionData: AppointmentSession[] = [];

        if (!historyError && unifiedHistoryData?.medical_history_entries) {
          // Combine appointment and entry data
          sessionData = completedAppointments
            .map(appointment => {
              const entry = unifiedHistoryData.medical_history_entries.find((e: any) => 
                e.appointment_id === appointment.id
              );
              
              if (!entry) return null; // Only include sessions that belong to this medical order

              return {
                id: appointment.id,
                appointment_date: appointment.appointment_date,
                appointment_time: appointment.appointment_time,
                professional_name: entry.professional_name,
                professional_id: entry.professional_id,
                observations: entry.observations,
                evolution: entry.evolution,
                status: appointment.status
              };
            })
            .filter(Boolean) as AppointmentSession[];
        }

      setSessions(sessionData);

      // Check if final summary already exists
      const { data: existingHistory, error: existingHistoryError } = await supabase
        .from('unified_medical_histories')
        .select('template_data')
        .eq('medical_order_id', medicalOrderId)
        .maybeSingle();

      if (!existingHistoryError && existingHistory?.template_data) {
        const templateData = existingHistory.template_data as any;
        if (templateData.final_summary) {
          setFinalSummary({
            initial_assessment: templateData.final_summary.initial_assessment || '',
            treatment_objectives: templateData.final_summary.treatment_objectives || '',
            sessions_summary: templateData.final_summary.sessions_summary || '',
            patient_evolution: templateData.final_summary.patient_evolution || '',
            final_recommendations: templateData.final_summary.final_recommendations || '',
            treatment_outcome: templateData.final_summary.treatment_outcome || '',
            discharge_notes: templateData.final_summary.discharge_notes || '',
            evolution_file_url: templateData.final_summary.evolution_file_url || '',
            evolution_file_name: templateData.final_summary.evolution_file_name || ''
          });

          // Set existing file if present
          if (templateData.final_summary.evolution_file_url) {
            setExistingFile({
              url: templateData.final_summary.evolution_file_url,
              name: templateData.final_summary.evolution_file_name || 'Evolución Clínica Final'
            });
          }
        }
      }

    } catch (error) {
      console.error('Error fetching medical order data:', error);
      toast.error('Error al cargar los datos de la orden médica');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File): Promise<{ url: string; name: string } | null> => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `final-evolution-${medicalOrderId}-${Date.now()}.${fileExt}`;
      const filePath = `final-evolutions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('medical-orders')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('medical-orders')
        .getPublicUrl(filePath);

      return { url: data.publicUrl, name: file.name };
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('No se pudo subir el archivo');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleViewFile = async (fileUrl: string) => {
    try {
      // Extract the file path from the URL
      const urlParts = fileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `final-evolutions/${fileName}`;

      const { data, error } = await supabase.storage
        .from('medical-orders')
        .createSignedUrl(filePath, 3600);

      if (error) {
        // Fallback to public URL
        window.open(fileUrl, '_blank');
        return;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing file:', error);
      toast.error('No se pudo abrir el archivo');
    }
  };

  const handleSaveFinalSummary = async () => {
    console.log('Debug - Attempting to save. AllSessionsCompleted:', allSessionsCompleted);
    console.log('Debug - Sessions length:', sessions.length);
    console.log('Debug - Medical order:', medicalOrder);
    
    if (!allSessionsCompleted) {
      toast.error('No se puede guardar. Faltan sesiones por completar.');
      return;
    }

    try {
      setSaving(true);
      let finalSummaryToSave = { ...finalSummary };

      // Upload file if selected
      if (selectedFile) {
        const uploadResult = await uploadFile(selectedFile);
        if (uploadResult) {
          finalSummaryToSave.evolution_file_url = uploadResult.url;
          finalSummaryToSave.evolution_file_name = uploadResult.name;
        }
      }

      // Update the unified medical history with the final summary
      const { error } = await supabase
        .from('unified_medical_histories')
        .update({
          template_data: {
            final_summary: finalSummaryToSave,
            completed_at: new Date().toISOString(),
            total_sessions_completed: sessions.length
          }
        })
        .eq('medical_order_id', medicalOrderId);

      if (error) throw error;

      // Mark medical order as completed
      const { error: orderError } = await supabase
        .from('medical_orders')
        .update({ completed: true })
        .eq('id', medicalOrderId);

      if (orderError) throw orderError;

      toast.success('Evolución clínica final guardada correctamente');
      setIsOpen(false);
      onSave?.();

    } catch (error) {
      console.error('Error saving final summary:', error);
      toast.error('Error al guardar la evolución clínica final');
    } finally {
      setSaving(false);
    }
  };

  const generateSessionsSummary = () => {
    if (sessions.length === 0) return '';

    return sessions.map((session, index) => {
      const sessionNumber = index + 1;
      const date = format(new Date(session.appointment_date), 'dd/MM/yyyy', { locale: es });
      const observations = session.observations || 'Sin observaciones registradas';
      const evolution = session.evolution || 'Sin evolución registrada';
      
      return `Sesión ${sessionNumber} (${date}):\nObservaciones: ${observations}\nEvolución: ${evolution}\n`;
    }).join('\n');
  };

  const handleAutoGenerateSummary = () => {
    const autoSummary = generateSessionsSummary();
    setFinalSummary(prev => ({
      ...prev,
      sessions_summary: autoSummary
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <FileSignature className="h-4 w-4" />
            Evolución Clínica Final
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Evolución Clínica Final - {medicalOrder?.description || 'Cargando...'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p>Cargando datos de la orden médica...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Medical Order Summary */}
            {medicalOrder && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumen de la Orden Médica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><strong>Descripción:</strong> {medicalOrder.description}</p>
                      <p><strong>Tipo:</strong> {medicalOrder.order_type}</p>
                    </div>
                    <div>
                      <p><strong>Sesiones totales:</strong> {medicalOrder.total_sessions}</p>
                      <p><strong>Sesiones completadas:</strong> {sessions.length}</p>
                      <Badge 
                        variant={allSessionsCompleted ? "default" : "secondary"}
                        className={allSessionsCompleted ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                      >
                        {allSessionsCompleted ? "Listo para cerrar" : "Pendiente completar sesiones"}
                      </Badge>
                    </div>
                  </div>
                  {!allSessionsCompleted && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-2">
                      <p className="text-sm text-yellow-700">
                        <strong>Atención:</strong> Debe completar todas las sesiones o marcar la orden como finalizada para poder cargar la evolución clínica final.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sessions Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Sesiones Realizadas ({sessions.length})</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAutoGenerateSummary}
                  >
                    Auto-generar resumen
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {sessions.map((session, index) => (
                      <div key={session.id} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">Sesión {index + 1}</Badge>
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(session.appointment_date), 'PPP', { locale: es })}</span>
                        <User className="h-3 w-3" />
                        <span>{session.professional_name}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* File Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evolución Clínica Final (Archivo)</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Suba la evolución clínica final escaneada o en formato digital
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {existingFile && !selectedFile && (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700">
                        <strong>Archivo actual:</strong> {existingFile.name}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewFile(existingFile.url)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>Seleccionar archivo de evolución</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*,.pdf,.doc,.docx"
                      className="flex-1"
                      disabled={!allSessionsCompleted}
                    />
                    {uploading && (
                      <span className="text-sm text-muted-foreground">Subiendo...</span>
                    )}
                  </div>
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Archivo seleccionado: {selectedFile.name}
                    </p>
                  )}
                  {!allSessionsCompleted && (
                    <p className="text-sm text-red-600">
                      Complete todas las sesiones para poder cargar el archivo
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Final Summary Form */}
            <ScrollArea className="h-96">
              <div className="space-y-4 pr-4">
                <div>
                  <Label htmlFor="initial_assessment">Evaluación Inicial (Opcional)</Label>
                  <Textarea
                    id="initial_assessment"
                    value={finalSummary.initial_assessment}
                    onChange={(e) => setFinalSummary(prev => ({ ...prev, initial_assessment: e.target.value }))}
                    placeholder="Describa la evaluación inicial del paciente..."
                    className="min-h-20"
                    disabled={!allSessionsCompleted}
                  />
                </div>

                <div>
                  <Label htmlFor="treatment_objectives">Objetivos del Tratamiento (Opcional)</Label>
                  <Textarea
                    id="treatment_objectives"
                    value={finalSummary.treatment_objectives}
                    onChange={(e) => setFinalSummary(prev => ({ ...prev, treatment_objectives: e.target.value }))}
                    placeholder="Indique los objetivos terapéuticos planteados..."
                    className="min-h-20"
                    disabled={!allSessionsCompleted}
                  />
                </div>

                <div>
                  <Label htmlFor="sessions_summary">Resumen de Sesiones (Opcional)</Label>
                  <Textarea
                    id="sessions_summary"
                    value={finalSummary.sessions_summary}
                    onChange={(e) => setFinalSummary(prev => ({ ...prev, sessions_summary: e.target.value }))}
                    placeholder="Resumen cronológico de las sesiones realizadas..."
                    className="min-h-32"
                    disabled={!allSessionsCompleted}
                  />
                </div>

                <div>
                  <Label htmlFor="patient_evolution">Evolución del Paciente (Opcional)</Label>
                  <Textarea
                    id="patient_evolution"
                    value={finalSummary.patient_evolution}
                    onChange={(e) => setFinalSummary(prev => ({ ...prev, patient_evolution: e.target.value }))}
                    placeholder="Describa la evolución del paciente durante el tratamiento..."
                    className="min-h-20"
                    disabled={!allSessionsCompleted}
                  />
                </div>

                <div>
                  <Label htmlFor="treatment_outcome">Resultado del Tratamiento (Opcional)</Label>
                  <Textarea
                    id="treatment_outcome"
                    value={finalSummary.treatment_outcome}
                    onChange={(e) => setFinalSummary(prev => ({ ...prev, treatment_outcome: e.target.value }))}
                    placeholder="Indique los resultados obtenidos..."
                    className="min-h-20"
                    disabled={!allSessionsCompleted}
                  />
                </div>

                <div>
                  <Label htmlFor="final_recommendations">Recomendaciones Finales (Opcional)</Label>
                  <Textarea
                    id="final_recommendations"
                    value={finalSummary.final_recommendations}
                    onChange={(e) => setFinalSummary(prev => ({ ...prev, final_recommendations: e.target.value }))}
                    placeholder="Incluya recomendaciones para seguimiento o futuras intervenciones..."
                    className="min-h-20"
                    disabled={!allSessionsCompleted}
                  />
                </div>

                <div>
                  <Label htmlFor="discharge_notes">Notas de Alta (Opcional)</Label>
                  <Textarea
                    id="discharge_notes"
                    value={finalSummary.discharge_notes}
                    onChange={(e) => setFinalSummary(prev => ({ ...prev, discharge_notes: e.target.value }))}
                    placeholder="Notas adicionales sobre el alta del tratamiento..."
                    className="min-h-20"
                    disabled={!allSessionsCompleted}
                  />
                </div>
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveFinalSummary} 
                disabled={saving || uploading || !allSessionsCompleted}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar Evolución Final'}
              </Button>
            </div>
            
            {!allSessionsCompleted && (
              <p className="text-sm text-red-600 text-center">
                Complete todas las sesiones para poder guardar la evolución final
              </p>
            )}
            
            {allSessionsCompleted && !selectedFile && !existingFile && (
              <p className="text-sm text-red-600 text-center">
                Debe cargar un archivo de evolución clínica final
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}