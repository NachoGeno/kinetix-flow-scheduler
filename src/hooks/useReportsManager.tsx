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

// Hook para obtener KPIs principales
export const useKPICore = () => {
  return useQuery({
    queryKey: ['reports-manager', 'kpi-core'],
    queryFn: async () => {
      // Como las vistas no están accesibles directamente, simulamos datos por ahora
      // En producción, esto se conectaría a las vistas de reporting
      const mockData: KPICore = {
        organization_id: '1',
        organization_name: 'Organización',
        report_date: new Date().toISOString().split('T')[0],
        today_completed_appointments: 45,
        today_total_appointments: 52,
        active_orders: 127,
        pending_docs: 8,
        active_patients: 892,
        new_patients_month: 23,
      };
      
      return mockData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

// Hook para obtener asistencia diaria
export const useAttendanceDaily = (days: number = 30) => {
  return useQuery({
    queryKey: ['reports-manager', 'attendance-daily', days],
    queryFn: async () => {
      // Simulamos datos de asistencia diaria por ahora
      const mockData: AttendanceDaily[] = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const total = Math.floor(Math.random() * 50) + 30;
        const completed = Math.floor(total * (0.7 + Math.random() * 0.25));
        const noShow = Math.floor((total - completed) * 0.6);
        const cancelled = total - completed - noShow;
        
        return {
          appointment_date: date.toISOString().split('T')[0],
          organization_id: '1',
          total_appointments: total,
          completed_appointments: completed,
          no_show_appointments: noShow,
          cancelled_appointments: cancelled,
          attendance_rate: Math.round((completed / total) * 100),
        };
      });
      
      return mockData;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook para obtener utilización de capacidad
export const useCapacityUtilization = () => {
  return useQuery({
    queryKey: ['reports-manager', 'capacity-utilization'],
    queryFn: async () => {
      // Simulamos datos de utilización de capacidad
      const mockData: CapacityUtilization[] = [
        {
          doctor_id: '1',
          doctor_name: 'Dr. García',
          specialty_name: 'Kinesiología',
          organization_id: '1',
          sessions_completed: 95,
          sessions_scheduled: 15,
          total_sessions: 110,
          completion_rate: 86.4,
          period_month: '2024-01-01',
        },
        {
          doctor_id: '2',
          doctor_name: 'Dra. Martínez',
          specialty_name: 'Fisioterapia',
          organization_id: '1',
          sessions_completed: 82,
          sessions_scheduled: 12,
          total_sessions: 94,
          completion_rate: 87.2,
          period_month: '2024-01-01',
        },
      ];
      
      return mockData;
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
};

// Hook para obtener pipeline de órdenes
export const useOrdersPipeline = (status?: string) => {
  return useQuery({
    queryKey: ['reports-manager', 'orders-pipeline', status],
    queryFn: async () => {
      // Simulamos datos de pipeline de órdenes
      const mockData: OrdersPipeline[] = [
        {
          order_id: '1',
          organization_id: '1',
          patient_name: 'Juan Pérez',
          doctor_name: 'Dr. García',
          order_type: 'fisioterapia',
          total_sessions: 10,
          sessions_used: 3,
          active_assignments: 2,
          sessions_remaining: 5,
          document_status: 'completa',
          presentation_status: 'pending',
          completed: false,
          urgent: false,
          order_date: '2024-01-15',
          obra_social_name: 'OSDE',
          pipeline_status: 'En Progreso',
        },
      ];
      
      return status && status !== 'all' 
        ? mockData.filter(item => item.pipeline_status === status)
        : mockData;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Hook para obtener estadísticas del dashboard con filtros
export const useDashboardStats = (
  startDate?: string,
  endDate?: string
) => {
  return useQuery({
    queryKey: ['reports-manager', 'dashboard-stats', startDate, endDate],
    queryFn: async () => {
      // Simulamos estadísticas del dashboard
      const mockStats = {
        total_appointments: 1250,
        completed_appointments: 1089,
        attendance_rate: 87.1,
        active_orders: 127,
        completed_orders: 89,
        pending_docs: 8,
        active_patients: 892,
        new_patients: 23,
      };
      
      return mockStats;
    },
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
};