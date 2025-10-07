import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types para las vistas de reporting
export interface AttendanceDaily {
  appointment_date: string;
  organization_id: string;
  total_appointments: number;
  completed_appointments: number;
  no_show_appointments: number;
  cancelled_appointments: number;
  attendance_rate: number;
}

export interface CapacityUtilization {
  doctor_id: string;
  doctor_name: string;
  specialty_name: string;
  organization_id: string;
  sessions_completed: number;
  sessions_scheduled: number;
  total_sessions: number;
  completion_rate: number;
  period_month: string;
}

export interface OrdersPipeline {
  order_id: string;
  organization_id: string;
  patient_name: string;
  doctor_name: string;
  order_type: string;
  total_sessions: number;
  sessions_used: number;
  active_assignments: number;
  sessions_remaining: number;
  document_status: string;
  presentation_status: string;
  completed: boolean;
  urgent: boolean;
  order_date: string;
  obra_social_name: string;
  pipeline_status: string;
}

export interface KPICore {
  organization_id: string;
  organization_name: string;
  report_date: string;
  today_completed_appointments: number;
  today_total_appointments: number;
  active_orders: number;
  pending_docs: number;
  active_patients: number;
  new_patients_month: number;
}

// Hook para obtener KPIs principales - DATOS REALES
export const useKPICore = () => {
  return useQuery({
    queryKey: ['reports-manager', 'kpi-core'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Citas de hoy
      const { data: todayAppointments, error: apptError } = await supabase
        .from('appointments')
        .select('status')
        .eq('appointment_date', today);

      if (apptError) throw apptError;

      // Órdenes activas
      const { count: activeOrdersCount, error: ordersError } = await supabase
        .from('medical_orders')
        .select('*', { count: 'exact', head: true })
        .eq('completed', false);

      if (ordersError) throw ordersError;

      // Documentos pendientes
      const { count: pendingDocsCount, error: docsError } = await supabase
        .from('medical_orders')
        .select('*', { count: 'exact', head: true })
        .eq('document_status', 'pendiente');

      if (docsError) throw docsError;

      // Pacientes activos
      const { count: activePatientsCount, error: patientsError } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (patientsError) throw patientsError;

      // Nuevos pacientes este mes
      const { count: newPatientsCount, error: newPatientsError } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstDayOfMonth);

      if (newPatientsError) throw newPatientsError;

      // Organización del usuario
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, organizations(name)')
        .single();

      const todayCompleted = todayAppointments?.filter(a => a.status === 'completed').length || 0;
      const todayTotal = todayAppointments?.length || 0;

      const kpiData: KPICore = {
        organization_id: profile?.organization_id || '',
        organization_name: (profile?.organizations as any)?.name || 'Organización',
        report_date: today,
        today_completed_appointments: todayCompleted,
        today_total_appointments: todayTotal,
        active_orders: activeOrdersCount || 0,
        pending_docs: pendingDocsCount || 0,
        active_patients: activePatientsCount || 0,
        new_patients_month: newPatientsCount || 0,
      };
      
      return kpiData;
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
};

// Hook para obtener asistencia diaria - DATOS REALES
export const useAttendanceDaily = (days: number = 30) => {
  return useQuery({
    queryKey: ['reports-manager', 'attendance-daily', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('appointment_date, status')
        .gte('appointment_date', startDateStr)
        .order('appointment_date', { ascending: true });

      if (error) throw error;

      // Agrupar por fecha
      const groupedByDate = appointments?.reduce((acc, apt) => {
        const date = apt.appointment_date;
        if (!acc[date]) {
          acc[date] = {
            total: 0,
            completed: 0,
            no_show: 0,
            cancelled: 0,
          };
        }
        acc[date].total++;
        if (apt.status === 'completed') acc[date].completed++;
        if (apt.status === 'no_show') acc[date].no_show++;
        if (apt.status === 'cancelled') acc[date].cancelled++;
        return acc;
      }, {} as Record<string, any>);

      // Obtener organización
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .single();

      const attendanceData: AttendanceDaily[] = Object.entries(groupedByDate || {}).map(([date, stats]) => ({
        appointment_date: date,
        organization_id: profile?.organization_id || '',
        total_appointments: stats.total,
        completed_appointments: stats.completed,
        no_show_appointments: stats.no_show,
        cancelled_appointments: stats.cancelled,
        attendance_rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      }));
      
      return attendanceData;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook para obtener utilización de capacidad - DATOS REALES
export const useCapacityUtilization = () => {
  return useQuery({
    queryKey: ['reports-manager', 'capacity-utilization'],
    queryFn: async () => {
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      const { data: doctors, error: doctorsError } = await supabase
        .from('doctors')
        .select(`
          id,
          profiles!inner(first_name, last_name),
          specialties!inner(name)
        `)
        .eq('is_active', true);

      if (doctorsError) throw doctorsError;

      // Obtener organización
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .single();

      const capacityData: CapacityUtilization[] = await Promise.all(
        (doctors || []).map(async (doctor) => {
          const { count: completedCount } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', doctor.id)
            .eq('status', 'completed')
            .gte('appointment_date', firstDayOfMonth);

          const { count: scheduledCount } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', doctor.id)
            .in('status', ['scheduled', 'confirmed', 'in_progress'])
            .gte('appointment_date', firstDayOfMonth);

          const completed = completedCount || 0;
          const scheduled = scheduledCount || 0;
          const total = completed + scheduled;

          return {
            doctor_id: doctor.id,
            doctor_name: `${(doctor.profiles as any).first_name} ${(doctor.profiles as any).last_name}`,
            specialty_name: (doctor.specialties as any).name,
            organization_id: profile?.organization_id || '',
            sessions_completed: completed,
            sessions_scheduled: scheduled,
            total_sessions: total,
            completion_rate: total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0,
            period_month: firstDayOfMonth,
          };
        })
      );
      
      return capacityData;
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
};

// Hook para obtener pipeline de órdenes - DATOS REALES
export const useOrdersPipeline = (status?: string) => {
  return useQuery({
    queryKey: ['reports-manager', 'orders-pipeline', status],
    queryFn: async () => {
      let query = supabase
        .from('medical_orders')
        .select(`
          id,
          order_type,
          total_sessions,
          sessions_used,
          completed,
          urgent,
          order_date,
          document_status,
          presentation_status,
          organization_id,
          patients!inner(
            profiles!inner(first_name, last_name)
          ),
          doctors(
            profiles!inner(first_name, last_name)
          ),
          obras_sociales_art(nombre)
        `)
        .order('order_date', { ascending: false });

      // Filtrar por estado si se proporciona
      if (status && status !== 'all') {
        if (status === 'pending') {
          query = query.eq('completed', false);
        } else if (status === 'ready_to_present') {
          query = query.eq('completed', true).eq('presentation_status', 'pending');
        } else if (status === 'submitted') {
          query = query.eq('presentation_status', 'submitted');
        }
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      // Obtener asignaciones activas para cada orden
      const pipelineData: OrdersPipeline[] = await Promise.all(
        (orders || []).map(async (order) => {
          const { count: activeAssignments } = await supabase
            .from('appointment_order_assignments')
            .select('appointments!inner(status)', { count: 'exact', head: true })
            .eq('medical_order_id', order.id)
            .in('appointments.status', ['scheduled', 'confirmed', 'in_progress']);

          const sessionsRemaining = order.total_sessions - order.sessions_used;
          let pipelineStatus = 'En Progreso';
          
          if (order.completed) {
            pipelineStatus = 'Completada';
          } else if (sessionsRemaining === 0) {
            pipelineStatus = 'Sesiones Agotadas';
          } else if (order.urgent) {
            pipelineStatus = 'Urgente';
          }

          const patientProfile = (order.patients as any)?.profiles;
          const doctorProfile = (order.doctors as any)?.profiles;

          return {
            order_id: order.id,
            organization_id: order.organization_id,
            patient_name: `${patientProfile?.first_name || ''} ${patientProfile?.last_name || ''}`.trim(),
            doctor_name: doctorProfile ? `${doctorProfile.first_name} ${doctorProfile.last_name}` : 'Sin asignar',
            order_type: order.order_type,
            total_sessions: order.total_sessions,
            sessions_used: order.sessions_used,
            active_assignments: activeAssignments || 0,
            sessions_remaining: sessionsRemaining,
            document_status: order.document_status,
            presentation_status: order.presentation_status || 'pending',
            completed: order.completed,
            urgent: order.urgent,
            order_date: order.order_date,
            obra_social_name: (order.obras_sociales_art as any)?.nombre || 'Particular',
            pipeline_status: pipelineStatus,
          };
        })
      );
      
      return pipelineData;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook para obtener estadísticas del dashboard con filtros - DATOS REALES
export const useDashboardStats = (
  startDate?: string,
  endDate?: string
) => {
  return useQuery({
    queryKey: ['reports-manager', 'dashboard-stats', startDate, endDate],
    queryFn: async () => {
      let appointmentsQuery = supabase
        .from('appointments')
        .select('status', { count: 'exact' });

      if (startDate) appointmentsQuery = appointmentsQuery.gte('appointment_date', startDate);
      if (endDate) appointmentsQuery = appointmentsQuery.lte('appointment_date', endDate);

      const { count: totalAppointments } = await appointmentsQuery;

      let completedQuery = supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      if (startDate) completedQuery = completedQuery.gte('appointment_date', startDate);
      if (endDate) completedQuery = completedQuery.lte('appointment_date', endDate);

      const { count: completedAppointments } = await completedQuery;

      const { count: activeOrders } = await supabase
        .from('medical_orders')
        .select('*', { count: 'exact', head: true })
        .eq('completed', false);

      const { count: completedOrders } = await supabase
        .from('medical_orders')
        .select('*', { count: 'exact', head: true })
        .eq('completed', true);

      const { count: pendingDocs } = await supabase
        .from('medical_orders')
        .select('*', { count: 'exact', head: true })
        .eq('document_status', 'pendiente');

      const { count: activePatients } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const { count: newPatients } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstDayOfMonth);

      const dashboardStats = {
        total_appointments: totalAppointments || 0,
        completed_appointments: completedAppointments || 0,
        attendance_rate: totalAppointments && totalAppointments > 0 
          ? Math.round((completedAppointments || 0) / totalAppointments * 100 * 10) / 10 
          : 0,
        active_orders: activeOrders || 0,
        completed_orders: completedOrders || 0,
        pending_docs: pendingDocs || 0,
        active_patients: activePatients || 0,
        new_patients: newPatients || 0,
      };
      
      return dashboardStats;
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
};