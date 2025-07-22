import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useUnifiedMedicalHistory() {
  const createOrUpdateMedicalHistoryEntry = useCallback(async (
    appointmentId: string,
    medicalOrderId: string | null,
    patientId: string,
    professionalId: string,
    professionalName: string,
    appointmentDate: string
  ) => {
    try {
      // Check if medical order exists
      if (!medicalOrderId) {
        console.log('No medical order found for appointment, skipping unified history creation');
        return;
      }

      // First, ensure unified medical history exists for this medical order
      let { data: existingHistory, error: historyError } = await supabase
        .from('unified_medical_histories')
        .select('id')
        .eq('medical_order_id', medicalOrderId)
        .maybeSingle();

      if (historyError) throw historyError;

      let unifiedHistoryId: string;

      if (!existingHistory) {
        // Create new unified medical history
        const { data: newHistory, error: createHistoryError } = await supabase
          .from('unified_medical_histories')
          .insert({
            medical_order_id: medicalOrderId,
            patient_id: patientId,
            template_data: {}
          })
          .select('id')
          .single();

        if (createHistoryError) throw createHistoryError;
        unifiedHistoryId = newHistory.id;
      } else {
        unifiedHistoryId = existingHistory.id;
      }

      // Check if entry already exists for this appointment
      const { data: existingEntry, error: entryCheckError } = await supabase
        .from('medical_history_entries')
        .select('id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (entryCheckError) throw entryCheckError;

      if (!existingEntry) {
        // Create new medical history entry
        const { error: entryError } = await supabase
          .from('medical_history_entries')
          .insert({
            unified_medical_history_id: unifiedHistoryId,
            appointment_id: appointmentId,
            appointment_date: appointmentDate,
            professional_name: professionalName,
            professional_id: professionalId,
            observations: null,
            evolution: null
          });

        if (entryError) throw entryError;
        
        console.log('Medical history entry created successfully');
      } else {
        console.log('Medical history entry already exists for this appointment');
      }
    } catch (error) {
      console.error('Error creating/updating medical history entry:', error);
      toast.error('Error al crear la entrada de historia clínica');
    }
  }, []);

  const updateMedicalHistoryEntry = useCallback(async (
    appointmentId: string,
    observations: string,
    evolution: string
  ) => {
    try {
      const { error } = await supabase
        .from('medical_history_entries')
        .update({
          observations,
          evolution,
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', appointmentId);

      if (error) throw error;
      
      toast.success('Historia clínica actualizada correctamente');
    } catch (error) {
      console.error('Error updating medical history entry:', error);
      toast.error('Error al actualizar la historia clínica');
    }
  }, []);

  return {
    createOrUpdateMedicalHistoryEntry,
    updateMedicalHistoryEntry
  };
}