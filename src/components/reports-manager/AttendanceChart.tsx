import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAttendanceDaily } from "@/hooks/useReportsManager";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function AttendanceChart() {
  const { data: attendanceData, isLoading, error } = useAttendanceDaily(14);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asistencia Últimos 14 Días</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !attendanceData?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asistencia Últimos 14 Días</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">
              {error ? 'Error al cargar datos' : 'No hay datos disponibles'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transformar datos para el gráfico
  const chartData = attendanceData
    .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
    .map(item => ({
      date: format(new Date(item.appointment_date), 'dd/MM', { locale: es }),
      fullDate: item.appointment_date,
      total: item.total_appointments,
      completed: item.completed_appointments,
      noShow: item.no_show_appointments,
      cancelled: item.cancelled_appointments,
      rate: Math.round(item.attendance_rate || 0)
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico de línea - Tasa de asistencia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tasa de Asistencia</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                fontSize={12}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                fontSize={12}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
                formatter={(value: number) => [`${value}%`, 'Tasa de Asistencia']}
                labelFormatter={(label) => {
                  const item = chartData.find(d => d.date === label);
                  return item ? format(new Date(item.fullDate), 'dd MMM yyyy', { locale: es }) : label;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="rate" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de barras - Volumen de citas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Volumen de Citas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                fontSize={12}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                fontSize={12}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    completed: 'Completadas',
                    noShow: 'No Show',
                    cancelled: 'Canceladas'
                  };
                  return [value, labels[name] || name];
                }}
                labelFormatter={(label) => {
                  const item = chartData.find(d => d.date === label);
                  return item ? format(new Date(item.fullDate), 'dd MMM yyyy', { locale: es }) : label;
                }}
              />
              <Bar dataKey="completed" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="noShow" stackId="a" fill="hsl(var(--destructive))" />
              <Bar dataKey="cancelled" stackId="a" fill="hsl(var(--muted))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}