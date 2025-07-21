import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Calendar, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Activity {
  id: string;
  type: "appointment" | "patient" | "order" | "progress_note";
  title: string;
  description: string;
  time: string;
  status: string;
  icon: any;
  created_at: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-success-light text-success-foreground';
    case 'new':
      return 'bg-primary-light text-primary-foreground';
    case 'pending':
      return 'bg-warning-light text-warning-foreground';
    case 'completed':
      return 'bg-medical-light-green text-medical-green';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'Confirmado';
    case 'new':
      return 'Nuevo';
    case 'pending':
      return 'Pendiente';
    case 'completed':
      return 'Completado';
    default:
      return status;
  }
};

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        const activities: Activity[] = [];

        // Fetch recent appointments
        const { data: appointments } = await supabase
          .from('appointments')
          .select(`
            id,
            status,
            created_at,
            updated_at,
            patient_id,
            doctor_id
          `)
          .order('updated_at', { ascending: false })
          .limit(5);

        // Get patient and doctor names for appointments
        for (const apt of appointments || []) {
          try {
            const { data: patient } = await supabase
              .from('patients')
              .select('profiles!inner(first_name, last_name)')
              .eq('id', apt.patient_id)
              .single();

            const { data: doctor } = await supabase
              .from('doctors')
              .select('profiles!inner(first_name, last_name)')
              .eq('id', apt.doctor_id)
              .single();

            const patientName = patient?.profiles ? `${patient.profiles.first_name} ${patient.profiles.last_name}` : 'Paciente';
            const doctorName = doctor?.profiles ? `${doctor.profiles.first_name} ${doctor.profiles.last_name}` : 'Doctor';
            
            activities.push({
              id: apt.id,
              type: "appointment",
              title: `Turno ${getStatusText(apt.status)}`,
              description: `${patientName} - Dr. ${doctorName}`,
              time: formatDistanceToNow(new Date(apt.updated_at), { addSuffix: true, locale: es }),
              status: apt.status,
              icon: Calendar,
              created_at: apt.updated_at
            });
          } catch (error) {
            console.error('Error fetching appointment details:', error);
          }
        }

        // Fetch recent patients (last 3)
        const { data: patients } = await supabase
          .from('patients')
          .select(`
            id,
            created_at,
            profiles!inner(first_name, last_name, dni)
          `)
          .order('created_at', { ascending: false })
          .limit(3);

        patients?.forEach(patient => {
          activities.push({
            id: patient.id,
            type: "patient",
            title: "Nuevo paciente registrado",
            description: `${patient.profiles?.first_name} ${patient.profiles?.last_name} - DNI: ${patient.profiles?.dni || 'N/A'}`,
            time: formatDistanceToNow(new Date(patient.created_at), { addSuffix: true, locale: es }),
            status: "new",
            icon: User,
            created_at: patient.created_at
          });
        });

        // Fetch recent medical orders (last 3)
        const { data: orders } = await supabase
          .from('medical_orders')
          .select(`
            id,
            description,
            total_sessions,
            completed,
            created_at,
            patient_id
          `)
          .order('created_at', { ascending: false })
          .limit(3);

        // Get patient names for orders
        for (const order of orders || []) {
          try {
            const { data: patient } = await supabase
              .from('patients')
              .select('profiles!inner(first_name, last_name)')
              .eq('id', order.patient_id)
              .single();

            const patientName = patient?.profiles ? `${patient.profiles.first_name} ${patient.profiles.last_name}` : 'Paciente';
            
            activities.push({
              id: order.id,
              type: "order",
              title: "Orden médica cargada",
              description: `${order.description} - ${patientName}`,
              time: formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es }),
              status: order.completed ? "completed" : "pending",
              icon: FileText,
              created_at: order.created_at
            });
          } catch (error) {
            console.error('Error fetching order details:', error);
          }
        }

        // Sort all activities by date
        activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        setActivities(activities.slice(0, 8)); // Show only top 8
      } catch (error) {
        console.error('Error fetching recent activity:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivity();
  }, []);

  if (loading) {
    return (
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Actividad Reciente
          </CardTitle>
          <CardDescription>
            Últimas acciones realizadas en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start gap-4 p-3 rounded-lg">
                <div className="w-8 h-8 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Actividad Reciente
        </CardTitle>
        <CardDescription>
          Últimas acciones realizadas en el sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay actividad reciente</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="p-2 rounded-full bg-primary/10">
                <activity.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {activity.title}
                  </p>
                  <Badge variant="secondary" className={getStatusColor(activity.status)}>
                    {getStatusText(activity.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activity.description}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {activity.time}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}