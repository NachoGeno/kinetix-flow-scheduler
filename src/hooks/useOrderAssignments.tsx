import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export function useOrderAssignments() {
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  const assignAppointmentToOrder = async (appointmentId: string, medicalOrderId: string) => {
    if (!profile) return;

    try {
      setLoading(true);

      // Insert or update assignment
      const { error } = await supabase
        .from('appointment_order_assignments')
        .upsert({
          appointment_id: appointmentId,
          medical_order_id: medicalOrderId,
          assigned_by: profile.id,
        });

      if (error) throw error;

      // Recalculate sessions for the patient
      const { data: appointment } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('id', appointmentId)
        .single();

      if (appointment) {
        await supabase.rpc('recalc_patient_order_sessions_with_assignments', {
          patient_uuid: appointment.patient_id
        });
      }

      toast({
        title: "Éxito",
        description: "Cita asignada a la orden médica correctamente",
      });

      return true;
    } catch (error) {
      console.error('Error assigning appointment to order:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar la cita a la orden médica",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getAppointmentAssignment = async (appointmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('appointment_order_assignments')
        .select(`
          medical_order_id,
          medical_order:medical_orders(description, total_sessions, sessions_used)
        `)
        .eq('appointment_id', appointmentId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error getting appointment assignment:', error);
      return null;
    }
  };

  const getPatientMedicalOrders = async (patientId: string) => {
    try {
      const { data, error } = await supabase
        .from('medical_orders')
        .select(`
          id,
          description,
          total_sessions,
          sessions_used,
          completed,
          order_date,
          doctor_name
        `)
        .eq('patient_id', patientId)
        .eq('completed', false)
        .order('order_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching patient medical orders:', error);
      return [];
    }
  };

  const getCompletedAppointmentsForPatient = async (patientId: string) => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          doctor:doctors(
            profile:profiles(first_name, last_name)
          ),
          assignment:appointment_order_assignments(
            medical_order_id,
            medical_order:medical_orders(description)
          )
        `)
        .eq('patient_id', patientId)
        .eq('status', 'completed')
        .order('appointment_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching completed appointments:', error);
      return [];
    }
  };

  const reassignAppointment = async (appointmentId: string, newOrderId: string) => {
    return await assignAppointmentToOrder(appointmentId, newOrderId);
  };

  const removeAssignment = async (appointmentId: string) => {
    if (!profile) return false;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('appointment_order_assignments')
        .delete()
        .eq('appointment_id', appointmentId);

      if (error) throw error;

      // Recalculate sessions for the patient
      const { data: appointment } = await supabase
        .from('appointments')
        .select('patient_id')
        .eq('id', appointmentId)
        .single();

      if (appointment) {
        await supabase.rpc('recalc_patient_order_sessions_with_assignments', {
          patient_uuid: appointment.patient_id
        });
      }

      toast({
        title: "Éxito",
        description: "Asignación eliminada correctamente",
      });

      return true;
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la asignación",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    assignAppointmentToOrder,
    getAppointmentAssignment,
    getPatientMedicalOrders,
    getCompletedAppointmentsForPatient,
    reassignAppointment,
    removeAssignment,
  };
}