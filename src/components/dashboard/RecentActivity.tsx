import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Calendar, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Activity {
  id: string;
  type: "appointment" | "patient" | "order";
  title: string;
  description: string;
  time: string;
  status: string;
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

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'appointment':
      return Calendar;
    case 'patient':
      return User;
    case 'order':
      return FileText;
    default:
      return Clock;
  }
};

export function RecentActivity() {
  const { data: activities = [], isLoading: loading } = useQuery({
    queryKey: ['recent-activity', 'organization-aware'],
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await supabase.functions.invoke('recent-activity');
      
      if (error) {
        console.error('Error fetching recent activity:', error);
        throw error;
      }
      
      return data || [];
    },
    staleTime: 1 * 60 * 1000, // 1 minute - activity data should be relatively fresh
    gcTime: 3 * 60 * 1000, // 3 minutes cache
  });

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
          activities.map((activity) => {
            const ActivityIcon = getActivityIcon(activity.type);
            return (
              <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="p-2 rounded-full bg-primary/10">
                  <ActivityIcon className="w-4 h-4 text-primary" />
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
            );
          })
        )}
      </CardContent>
    </Card>
  );
}