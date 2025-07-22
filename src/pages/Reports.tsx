import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, BarChart3, PieChart, Users, TrendingUp, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie } from "recharts";

interface Doctor {
  id: string;
  profile: {
    first_name: string;
    last_name: string;
  };
}

interface PatientsByMonth {
  year: number;
  month: number;
  month_name: string;
  patients_attended: number;
}

interface PatientsByDoctor {
  doctor_id: string;
  doctor_name: string;
  patients_attended: number;
  percentage: number;
}

interface AppointmentStats {
  status: string;
  count: number;
  percentage: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const statusTranslations = {
  'completed': 'Completado',
  'scheduled': 'Programado',
  'cancelled': 'Cancelado',
  'confirmed': 'Confirmado',
  'in_progress': 'En Progreso'
};

export default function Reports() {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientsByMonth, setPatientsByMonth] = useState<PatientsByMonth[]>([]);
  const [patientsByDoctor, setPatientsByDoctor] = useState<PatientsByDoctor[]>([]);
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDoctors();
    fetchReportsData();
  }, []);

  useEffect(() => {
    fetchReportsData();
  }, [startDate, endDate, selectedDoctor]);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from("doctors")
        .select(`
          id,
          profile:profiles(first_name, last_name)
        `)
        .eq("is_active", true);

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error("Error fetching doctors:", error);
    }
  };

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPatientsByMonth(),
        fetchPatientsByDoctor(),
        fetchAppointmentStats()
      ]);
    } catch (error) {
      console.error("Error fetching reports data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de reportes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientsByMonth = async () => {
    try {
      const { data, error } = await supabase.rpc("get_patients_attended_by_month", {
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        doctor_filter: selectedDoctor === "all" ? null : selectedDoctor
      });

      if (error) throw error;
      setPatientsByMonth(data || []);
    } catch (error) {
      console.error("Error fetching patients by month:", error);
    }
  };

  const fetchPatientsByDoctor = async () => {
    try {
      const { data, error } = await supabase.rpc("get_patients_by_doctor", {
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null
      });

      if (error) throw error;
      setPatientsByDoctor(data || []);
    } catch (error) {
      console.error("Error fetching patients by doctor:", error);
    }
  };

  const fetchAppointmentStats = async () => {
    try {
      const { data, error } = await supabase.rpc("get_appointment_stats", {
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        doctor_filter: selectedDoctor === "all" ? null : selectedDoctor
      });

      if (error) throw error;
      setAppointmentStats(data || []);
    } catch (error) {
      console.error("Error fetching appointment stats:", error);
    }
  };

  const chartDataPieDoctor = patientsByDoctor.map((item, index) => ({
    name: item.doctor_name,
    value: item.patients_attended,
    percentage: item.percentage
  }));

  const chartDataPieStats = appointmentStats.map((item, index) => ({
    name: statusTranslations[item.status as keyof typeof statusTranslations] || item.status,
    value: item.count,
    percentage: item.percentage
  }));

  const chartDataBarMonth = patientsByMonth.map(item => ({
    name: `${item.month_name.trim()} ${item.year}`,
    pacientes: item.patients_attended
  }));

  const exportToCSV = (data: any[], filename: string) => {
    const csvContent = [
      Object.keys(data[0]).join(","),
      ...data.map(row => Object.values(row).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground">
            Análisis y estadísticas del centro médico
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Fecha inicio</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Fecha fin</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Profesional</label>
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Seleccionar profesional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los profesionales</SelectItem>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.profile.first_name} {doctor.profile.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button 
              onClick={() => {
                setStartDate(undefined);
                setEndDate(undefined);
                setSelectedDoctor("all");
              }}
              variant="outline"
            >
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de reportes */}
      <Tabs defaultValue="patients-month" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="patients-month">Pacientes por Mes</TabsTrigger>
          <TabsTrigger value="patients-doctor">Por Profesional</TabsTrigger>
          <TabsTrigger value="appointments-stats">Estadísticas Turnos</TabsTrigger>
          <TabsTrigger value="costs">Costos</TabsTrigger>
        </TabsList>

        {/* Pacientes por mes */}
        <TabsContent value="patients-month" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Pacientes Atendidos por Mes
                </CardTitle>
                <CardDescription>
                  Cantidad total de pacientes únicos atendidos cada mes
                </CardDescription>
              </div>
              <Button 
                onClick={() => exportToCSV(patientsByMonth, 'pacientes-por-mes')}
                variant="outline" 
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataBarMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="pacientes" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pacientes por profesional */}
        <TabsContent value="patients-doctor" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Pacientes por Profesional
                </CardTitle>
                <CardDescription>
                  Distribución de pacientes atendidos por cada profesional
                </CardDescription>
              </div>
              <Button 
                onClick={() => exportToCSV(patientsByDoctor, 'pacientes-por-profesional')}
                variant="outline" 
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Tooltip 
                        formatter={(value, name) => [`${value} pacientes`, name]}
                      />
                      <Pie dataKey="value" data={chartDataPieDoctor} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                        {chartDataPieDoctor.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold">Detalles</h3>
                  <div className="space-y-2">
                    {patientsByDoctor.map((doctor, index) => (
                      <div key={doctor.doctor_id} className="flex items-center justify-between p-2 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{doctor.doctor_name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{doctor.patients_attended} pacientes</div>
                          <div className="text-sm text-muted-foreground">{doctor.percentage}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Estadísticas de turnos */}
        <TabsContent value="appointments-stats" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Estadísticas de Turnos
                </CardTitle>
                <CardDescription>
                  Distribución de turnos por estado
                </CardDescription>
              </div>
              <Button 
                onClick={() => exportToCSV(appointmentStats, 'estadisticas-turnos')}
                variant="outline" 
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Tooltip 
                        formatter={(value, name) => [`${value} turnos`, name]}
                      />
                      <Pie dataKey="value" data={chartDataPieStats} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                        {chartDataPieStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold">Detalles</h3>
                  <div className="space-y-2">
                    {appointmentStats.map((stat, index) => (
                      <div key={stat.status} className="flex items-center justify-between p-2 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">
                            {statusTranslations[stat.status as keyof typeof statusTranslations] || stat.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{stat.count} turnos</div>
                          <div className="text-sm text-muted-foreground">{stat.percentage}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costos */}
        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Gestión de Costos por Profesional
              </CardTitle>
              <CardDescription>
                Configurar valores de honorarios y ver costos mensuales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Funcionalidad de costos en desarrollo
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Se incluirá gestión de valores de honorarios y cálculo de costos mensuales
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}