import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Download, BarChart3, PieChart, Users, TrendingUp, DollarSign, Clock, FileText, AlertTriangle } from "lucide-react";
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
  month: string;
  patients_count: number;
}

interface PatientsByDoctor {
  doctor_id: string;
  doctor_name: string;
  patients_count: number;
}

interface AppointmentStats {
  status: string;
  count: number;
  percentage: number;
}

interface NewPatients {
  month: string;
  new_patients_count: number;
}

interface ActivePatients {
  patient_id: string;
  patient_name: string;
  active_orders_count: number;
}

interface PatientsWithoutHistory {
  patient_id: string;
  patient_name: string;
  last_appointment_date: string;
}

interface ProfessionalWorkHours {
  doctor_id: string;
  doctor_name: string;
  specialty_name: string;
  total_hours: number;
  total_sessions: number;
}

interface AppointmentsByTime {
  time_slot: string;
  appointments_count: number;
}

interface ObraSocial {
  id: string;
  nombre: string;
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
  const [selectedObraSocial, setSelectedObraSocial] = useState<string>("all");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([]);
  
  // Existing data
  const [patientsByMonth, setPatientsByMonth] = useState<PatientsByMonth[]>([]);
  const [patientsByDoctor, setPatientsByDoctor] = useState<PatientsByDoctor[]>([]);
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats[]>([]);
  
  // New reports data
  const [newPatients, setNewPatients] = useState<NewPatients[]>([]);
  const [activePatients, setActivePatients] = useState<ActivePatients[]>([]);
  const [patientsWithoutHistory, setPatientsWithoutHistory] = useState<PatientsWithoutHistory[]>([]);
  const [professionalWorkHours, setProfessionalWorkHours] = useState<ProfessionalWorkHours[]>([]);
  const [appointmentsByTime, setAppointmentsByTime] = useState<AppointmentsByTime[]>([]);
  const [economicStats, setEconomicStats] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDoctors();
    fetchObrasSociales();
    fetchReportsData();
  }, []);

  useEffect(() => {
    fetchReportsData();
  }, [startDate, endDate, selectedDoctor, selectedObraSocial]);

  const getCurrentUserOrgId = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      return profile?.organization_id || null;
    } catch (error) {
      console.error('Error getting user organization:', error);
      return null;
    }
  };

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const userOrgId = await getCurrentUserOrgId();
      if (!userOrgId) {
        console.error('No organization found for current user');
        return;
      }

      const { data, error } = await supabase
        .from("doctors")
        .select(`
          id,
          profile:profiles(first_name, last_name)
        `)
        .eq("is_active", true)
        .eq("organization_id", userOrgId);

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error("Error fetching doctors:", error);
    }
  };

  const fetchObrasSociales = async () => {
    try {
      const userOrgId = await getCurrentUserOrgId();
      if (!userOrgId) {
        console.error('No organization found for current user');
        return;
      }

      const { data, error } = await supabase
        .from("obras_sociales_art")
        .select("id, nombre")
        .eq("is_active", true)
        .eq("organization_id", userOrgId)
        .order("nombre");

      if (error) throw error;
      setObrasSociales(data || []);
    } catch (error) {
      console.error("Error fetching obras sociales:", error);
    }
  };

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPatientsByMonth(),
        fetchPatientsByDoctor(),
        fetchAppointmentStats(),
        fetchNewPatients(),
        fetchActivePatients(),
        fetchPatientsWithoutHistory(),
        fetchProfessionalWorkHours(),
        fetchAppointmentsByTime(),
        fetchEconomicStats()
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

  const fetchNewPatients = async () => {
    try {
      const { data, error } = await supabase.rpc("get_new_patients_by_month", {
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null
      });

      if (error) throw error;
      setNewPatients(data as any || []);
    } catch (error) {
      console.error("Error fetching new patients:", error);
    }
  };

  const fetchActivePatients = async () => {
    try {
      const { data, error } = await supabase.rpc("get_active_patients_in_treatment");

      if (error) throw error;
      setActivePatients(data as any || []);
    } catch (error) {
      console.error("Error fetching active patients:", error);
    }
  };

  const fetchPatientsWithoutHistory = async () => {
    try {
      const { data, error } = await supabase.rpc("get_patients_without_closed_history");

      if (error) throw error;
      setPatientsWithoutHistory(data as any || []);
    } catch (error) {
      console.error("Error fetching patients without history:", error);
    }
  };

  const fetchProfessionalWorkHours = async () => {
    try {
      const { data, error } = await supabase.rpc("get_professional_work_hours", {
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        doctor_filter: selectedDoctor === "all" ? null : selectedDoctor
      });

      if (error) throw error;
      setProfessionalWorkHours(data as any || []);
    } catch (error) {
      console.error("Error fetching professional work hours:", error);
    }
  };

  const fetchAppointmentsByTime = async () => {
    try {
      const { data, error } = await supabase.rpc("get_appointments_by_time_slot", {
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        doctor_filter: selectedDoctor === "all" ? null : selectedDoctor
      });

      if (error) throw error;
      setAppointmentsByTime(data || []);
    } catch (error) {
      console.error("Error fetching appointments by time:", error);
    }
  };

  const fetchEconomicStats = async () => {
    try {
      const { data, error } = await supabase.rpc("get_stats_by_obra_social", {
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null
      });

      if (error) throw error;
      setEconomicStats(data || []);
    } catch (error) {
      console.error("Error fetching economic stats:", error);
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
    value: item.patients_count,
    percentage: 0 // Will be calculated if needed
  }));

  const chartDataPieStats = appointmentStats.map((item, index) => ({
    name: statusTranslations[item.status as keyof typeof statusTranslations] || item.status,
    value: item.count,
    percentage: item.percentage
  }));

  const chartDataBarMonth = patientsByMonth.map(item => ({
    name: item.month,
    pacientes: item.patients_count
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

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Obra Social</label>
            <Select value={selectedObraSocial} onValueChange={setSelectedObraSocial}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Seleccionar obra social" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las obras sociales</SelectItem>
                {obrasSociales.map((obraSocial) => (
                  <SelectItem key={obraSocial.id} value={obraSocial.id}>
                    {obraSocial.nombre}
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
                setSelectedObraSocial("all");
              }}
              variant="outline"
            >
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de reportes */}
      <Tabs defaultValue="patients" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="patients">Pacientes</TabsTrigger>
          <TabsTrigger value="professionals">Profesionales</TabsTrigger>
          <TabsTrigger value="appointments">Turnos</TabsTrigger>
          <TabsTrigger value="economic">Económicos</TabsTrigger>
          <TabsTrigger value="presentations">Presentaciones</TabsTrigger>
        </TabsList>

        {/* Tab Pacientes */}
        <TabsContent value="patients" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pacientes nuevos por mes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Pacientes Nuevos por Mes
                  </CardTitle>
                  <CardDescription>
                    Cantidad de pacientes registrados cada mes
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => exportToCSV(newPatients, 'pacientes-nuevos-por-mes')}
                  variant="outline" 
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={newPatients.map(item => ({
                      name: item.month,
                      pacientes: item.new_patients_count
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="pacientes" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pacientes activos en tratamiento */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Pacientes Activos ({activePatients.length})
                  </CardTitle>
                  <CardDescription>
                    Pacientes con órdenes médicas activas
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => exportToCSV(activePatients, 'pacientes-activos')}
                  variant="outline" 
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Obra Social</TableHead>
                        <TableHead>Órdenes</TableHead>
                        <TableHead>Último Turno</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activePatients.slice(0, 10).map((patient) => (
                        <TableRow key={patient.patient_id}>
                          <TableCell className="font-medium">{patient.patient_name}</TableCell>
                          <TableCell>N/A</TableCell>
                          <TableCell>{patient.active_orders_count}</TableCell>
                          <TableCell>N/A</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pacientes sin historia clínica cerrada */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Pacientes Sin Historia Clínica Cerrada ({patientsWithoutHistory.length})
                </CardTitle>
                <CardDescription>
                  Pacientes con sesiones completadas que requieren cierre de historia clínica
                </CardDescription>
              </div>
              <Button 
                onClick={() => exportToCSV(patientsWithoutHistory, 'pacientes-sin-historia-cerrada')}
                variant="outline" 
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Obra Social</TableHead>
                    <TableHead>Sesiones Completadas</TableHead>
                    <TableHead>Estado Historia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientsWithoutHistory.map((patient) => (
                    <TableRow key={patient.patient_id}>
                      <TableCell className="font-medium">{patient.patient_name}</TableCell>
                      <TableCell>N/A</TableCell>
                      <TableCell>N/A</TableCell>
                      <TableCell>
                        <span className="text-yellow-600 font-medium">
                          {patient.last_appointment_date 
                            ? format(new Date(patient.last_appointment_date), "dd/MM/yyyy")
                            : 'Sin fecha'
                          }
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Profesionales */}
        <TabsContent value="professionals" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pacientes atendidos por profesional */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Pacientes por Profesional
                  </CardTitle>
                  <CardDescription>
                    Distribución de pacientes atendidos
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
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Tooltip formatter={(value, name) => [`${value} pacientes`, name]} />
                      <Pie 
                        dataKey="patients_attended" 
                        data={patientsByDoctor} 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={80} 
                        fill="#8884d8" 
                        label={({ doctor_name, percentage }) => `${doctor_name} (${percentage}%)`}
                      >
                        {patientsByDoctor.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Horas trabajadas estimadas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Horas Trabajadas Estimadas
                  </CardTitle>
                  <CardDescription>
                    Basado en duración de turnos completados
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => exportToCSV(professionalWorkHours, 'horas-trabajadas-profesionales')}
                  variant="outline" 
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profesional</TableHead>
                      <TableHead>Especialidad</TableHead>
                      <TableHead>Turnos</TableHead>
                      <TableHead>Horas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {professionalWorkHours.map((professional) => (
                      <TableRow key={professional.doctor_id}>
                        <TableCell className="font-medium">{professional.doctor_name}</TableCell>
                        <TableCell>{professional.specialty_name}</TableCell>
                        <TableCell>{professional.total_sessions}</TableCell>
                        <TableCell className="font-semibold">{professional.total_hours.toFixed(2)}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Turnos */}
        <TabsContent value="appointments" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Turnos por horario */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Turnos por Horario
                  </CardTitle>
                  <CardDescription>
                    Distribución de turnos por franja horaria
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => exportToCSV(appointmentsByTime, 'turnos-por-horario')}
                  variant="outline" 
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={appointmentsByTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time_slot" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total_appointments" fill="#3b82f6" name="Total" />
                      <Bar dataKey="completed_appointments" fill="#10b981" name="Completados" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Estadísticas de turnos por estado */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Estados de Turnos
                  </CardTitle>
                  <CardDescription>
                    Distribución por estado
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => exportToCSV(appointmentStats, 'estados-turnos')}
                  variant="outline" 
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Tooltip formatter={(value, name) => [`${value} turnos`, name]} />
                      <Pie 
                        dataKey="count" 
                        data={appointmentStats.map(stat => ({
                          ...stat,
                          name: statusTranslations[stat.status as keyof typeof statusTranslations] || stat.status
                        }))}
                        cx="50%" 
                        cy="50%" 
                        outerRadius={80} 
                        fill="#8884d8" 
                        label={({ name, percentage }) => `${name} (${percentage}%)`}
                      >
                        {appointmentStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pacientes atendidos por mes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Pacientes Atendidos por Mes
                </CardTitle>
                <CardDescription>
                  Evolución mensual de pacientes únicos atendidos
                </CardDescription>
              </div>
              <Button 
                onClick={() => exportToCSV(patientsByMonth, 'pacientes-atendidos-por-mes')}
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
                  <BarChart data={patientsByMonth.map(item => ({
                    name: item.month,
                    pacientes: item.patients_count
                  }))}>
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

        {/* Tab Económicos */}
        <TabsContent value="economic" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Análisis Económico por Obra Social
                </CardTitle>
                <CardDescription>
                  Producción y costos por obra social
                </CardDescription>
              </div>
              <Button 
                onClick={() => exportToCSV(economicStats, 'analisis-economico-obras-sociales')}
                variant="outline" 
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Obra Social</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Pacientes</TableHead>
                    <TableHead>Sesiones</TableHead>
                    <TableHead>Órdenes</TableHead>
                    <TableHead>Costo Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {economicStats.map((stat) => (
                    <TableRow key={stat.obra_social_id}>
                      <TableCell className="font-medium">{stat.obra_social_name}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          stat.tipo === 'art' ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                        )}>
                          {stat.tipo?.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>{stat.pacientes_atendidos}</TableCell>
                      <TableCell>{stat.sesiones_realizadas}</TableCell>
                      <TableCell>{stat.ordenes_medicas}</TableCell>
                      <TableCell className="font-semibold">
                        ${Number(stat.costo_total).toLocaleString('es-AR', { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Tab Presentaciones */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Gestión de Presentaciones
              </CardTitle>
              <CardDescription>
                Control de presentaciones a obras sociales - Próximamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Módulo de Presentaciones</h3>
                <p className="text-muted-foreground mb-4">
                  Esta sección incluirá el seguimiento de presentaciones enviadas, 
                  pendientes e incompletas para cada obra social.
                </p>
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="text-sm text-muted-foreground">Enviadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">0</div>
                    <div className="text-sm text-muted-foreground">Pendientes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">0</div>
                    <div className="text-sm text-muted-foreground">Incompletas</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Presentaciones */}
        <TabsContent value="presentations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Gestión de Presentaciones
              </CardTitle>
              <CardDescription>
                Control de presentaciones a obras sociales - Próximamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Módulo de Presentaciones</h3>
                <p className="text-muted-foreground mb-4">
                  Esta sección incluirá el seguimiento de presentaciones enviadas, 
                  pendientes e incompletas para cada obra social.
                </p>
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="text-sm text-muted-foreground">Enviadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">0</div>
                    <div className="text-sm text-muted-foreground">Pendientes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">0</div>
                    <div className="text-sm text-muted-foreground">Incompletas</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}