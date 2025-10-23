import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';

interface WeeklyStatsBarProps {
  totalAppointments: number;
  statusCounts: { [key: string]: number };
}

export default function WeeklyStatsBar({ totalAppointments, statusCounts }: WeeklyStatsBarProps) {
  const confirmedCount = (statusCounts.confirmed || 0) + (statusCounts.in_progress || 0);
  const scheduledCount = statusCounts.scheduled || 0;
  const completedCount = statusCounts.completed || 0;
  const cancelledCount = (statusCounts.cancelled || 0) + (statusCounts.no_show || 0);

  const stats = [
    {
      label: 'Total Turnos',
      value: totalAppointments,
      icon: Calendar,
      colorClass: 'text-primary'
    },
    {
      label: 'Agendados',
      value: scheduledCount,
      icon: Clock,
      colorClass: 'text-primary'
    },
    {
      label: 'Confirmados',
      value: confirmedCount,
      icon: CheckCircle,
      colorClass: 'text-success'
    },
    {
      label: 'Completados',
      value: completedCount,
      icon: CheckCircle,
      colorClass: 'text-primary-dark'
    },
    {
      label: 'Cancelados/Ausentes',
      value: cancelledCount,
      icon: XCircle,
      colorClass: 'text-destructive'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-accent/10 ${stat.colorClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
