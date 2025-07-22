import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Calendar, User, FileText, Plus, Edit2, Save, X, FileSignature, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FinalClinicalHistoryForm } from './FinalClinicalHistoryForm';

interface MedicalOrder {
  id: string;
  description: string;
  total_sessions: number;
  sessions_used: number;
  order_type: string;
  created_at: string;
  completed: boolean;
}

interface MedicalHistoryEntry {
  id: string;
  appointment_id: string;
  appointment_date: string;
  professional_name: string;
  professional_id: string;
  observations: string | null;
  evolution: string | null;
  created_at: string;
  updated_at: string;
}

interface UnifiedMedicalHistory {
  id: string;
  medical_order_id: string;
  patient_id: string;
  template_data: any;
  created_at: string;
  updated_at: string;
  medical_order: MedicalOrder;
  entries: MedicalHistoryEntry[];
}

interface UnifiedMedicalHistoryProps {
  patientId: string;
}

export function UnifiedMedicalHistory({ patientId }: UnifiedMedicalHistoryProps) {
  const [medicalHistories, setMedicalHistories] = useState<UnifiedMedicalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ observations: '', evolution: '' });

  useEffect(() => {
    fetchUnifiedMedicalHistories();
  }, [patientId]);

  const fetchUnifiedMedicalHistories = async () => {
    try {
      setLoading(true);
      
      // Fetch unified medical histories with their medical orders and entries
      const { data: histories, error } = await supabase
        .from('unified_medical_histories')
        .select(`
          *,
          medical_order:medical_orders(
            id,
            description,
            total_sessions,
            sessions_used,
            order_type,
            created_at,
            completed
          )
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out histories without valid medical orders
      const validHistories = (histories || []).filter(h => h.medical_order && typeof h.medical_order === 'object');

      // Fetch entries for each history
      const historiesWithEntries = await Promise.all(
        validHistories.map(async (history) => {
          const { data: entries, error: entriesError } = await supabase
            .from('medical_history_entries')
            .select('*')
            .eq('unified_medical_history_id', history.id)
            .order('appointment_date', { ascending: true }); // Chronological order

          if (entriesError) throw entriesError;

          return {
            ...history,
            entries: entries || []
          } as UnifiedMedicalHistory;
        })
      );

      setMedicalHistories(historiesWithEntries);
    } catch (error) {
      console.error('Error fetching unified medical histories:', error);
      toast.error('Error al cargar las historias clínicas');
    } finally {
      setLoading(false);
    }
  };

  const handleEditEntry = (entryId: string, observations: string | null, evolution: string | null) => {
    setEditingEntry(entryId);
    setEditForm({ 
      observations: observations || '', 
      evolution: evolution || '' 
    });
  };

  const handleSaveEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('medical_history_entries')
        .update({
          observations: editForm.observations,
          evolution: editForm.evolution,
          updated_at: new Date().toISOString()
        })
        .eq('id', entryId);

      if (error) throw error;

      toast.success('Entrada actualizada correctamente');
      setEditingEntry(null);
      fetchUnifiedMedicalHistories();
    } catch (error) {
      console.error('Error updating entry:', error);
      toast.error('Error al actualizar la entrada');
    }
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setEditForm({ observations: '', evolution: '' });
  };

  const getSessionProgress = (totalSessions: number, sessionsUsed: number) => {
    const percentage = (sessionsUsed / totalSessions) * 100;
    return {
      percentage: Math.min(percentage, 100),
      remaining: Math.max(totalSessions - sessionsUsed, 0)
    };
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (medicalHistories.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No hay historias clínicas unificadas para este paciente
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {medicalHistories.map((history) => {
        const progress = getSessionProgress(
          history.medical_order.total_sessions,
          history.medical_order.sessions_used
        );

        return (
          <Card key={history.id} className="w-full">
            <CardHeader>
              <div className="flex items-start justify-between">
                 <div className="space-y-2">
                   <CardTitle className="text-lg">
                     {history.medical_order.description}
                   </CardTitle>
                   <div className="flex items-center gap-4">
                     <Badge variant="outline">
                       {history.entries.length} / {history.medical_order.total_sessions} sesiones
                     </Badge>
                     <Badge 
                       variant={history.medical_order.completed ? "default" : "secondary"}
                     >
                       {history.medical_order.completed ? "Tratamiento completado" : `${Math.max(history.medical_order.total_sessions - history.entries.length, 0)} sesiones restantes`}
                     </Badge>
                   </div>
                 </div>
                 <div className="flex gap-2">
                   {history.medical_order.completed ? (
                     <Badge variant="default" className="gap-1">
                       <CheckCircle className="h-3 w-3" />
                       Historia Final Completada
                     </Badge>
                   ) : (
                     <FinalClinicalHistoryForm
                       medicalOrderId={history.medical_order.id}
                       patientId={patientId}
                       onSave={fetchUnifiedMedicalHistories}
                       trigger={
                         <Button variant="outline" size="sm" className="gap-1">
                           <FileSignature className="h-3 w-3" />
                           Completar Historia Final
                         </Button>
                       }
                     />
                   )}
                 </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Evolución del Tratamiento
                </h4>

                {history.entries.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No hay entradas registradas para este tratamiento
                  </p>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {history.entries.map((entry, index) => (
                        <div key={entry.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(entry.appointment_date), 'PPP', { locale: es })}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <User className="h-4 w-4" />
                                {entry.professional_name}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                             <Badge variant="outline" className="text-xs">
                                Sesión {index + 1}
                              </Badge>
                              {editingEntry !== entry.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditEntry(entry.id, entry.observations, entry.evolution)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {editingEntry === entry.id ? (
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium mb-2 block">
                                  Observaciones
                                </label>
                                <Textarea
                                  value={editForm.observations}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, observations: e.target.value }))}
                                  placeholder="Registre las observaciones de la sesión..."
                                  className="min-h-20"
                                />
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium mb-2 block">
                                  Evolución
                                </label>
                                <Textarea
                                  value={editForm.evolution}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, evolution: e.target.value }))}
                                  placeholder="Describa la evolución del paciente..."
                                  className="min-h-20"
                                />
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEntry(entry.id)}
                                >
                                  <Save className="h-4 w-4 mr-2" />
                                  Guardar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {entry.observations && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-1">
                                    Observaciones:
                                  </p>
                                  <p className="text-sm whitespace-pre-wrap">
                                    {entry.observations}
                                  </p>
                                </div>
                              )}
                              
                              {entry.evolution && (
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground mb-1">
                                    Evolución:
                                  </p>
                                  <p className="text-sm whitespace-pre-wrap">
                                    {entry.evolution}
                                  </p>
                                </div>
                              )}

                              {!entry.observations && !entry.evolution && (
                                <p className="text-sm text-muted-foreground italic">
                                  Sin observaciones registradas
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}