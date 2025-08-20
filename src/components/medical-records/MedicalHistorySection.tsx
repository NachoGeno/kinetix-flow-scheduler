import { useState, useEffect } from 'react';
import { Calendar, Clock, FileText, Eye, User, History, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { UnifiedMedicalHistory } from './UnifiedMedicalHistory';

interface CompletedAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  reason: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  doctor: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
    };
    specialty: {
      name: string;
      color: string;
    };
  };
  medical_order?: {
    id: string;
    description: string;
    total_sessions: number;
    sessions_used: number;
  };
}

interface PatientFile {
  id: string;
  name: string;
  url: string;
  type: string;
  uploaded_date: string;
}

interface MedicalHistorySectionProps {
  patientId: string;
}

export default function MedicalHistorySection({ patientId }: MedicalHistorySectionProps) {
  const [completedAppointments, setCompletedAppointments] = useState<CompletedAppointment[]>([]);
  const [patientFiles, setPatientFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    if (patientId) {
      fetchCompletedAppointments();
      fetchPatientFiles();
    }
  }, [patientId]);

  const fetchCompletedAppointments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          reason,
          diagnosis,
          treatment_plan,
          doctor:doctors(
            id,
            profile:profiles(first_name, last_name),
            specialty:specialties(name, color)
          ),
          medical_orders!inner(
            id,
            description,
            total_sessions,
            sessions_used
          )
        `)
        .eq('patient_id', patientId)
        .eq('status', 'completed')
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });

      if (error) throw error;

      setCompletedAppointments(data || []);
    } catch (error) {
      console.error('Error fetching completed appointments:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los turnos completados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientFiles = async () => {
    try {
      // Get files from various storage locations related to this patient
      const { data: medicalOrderFiles } = await supabase.storage
        .from('medical-orders')
        .list(`final-evolutions`, {
          search: patientId
        });

      const { data: attendanceFiles } = await supabase.storage
        .from('medical-orders')
        .list(`attendance`, {
          search: `${patientId}_attendance`
        });

      const files: PatientFile[] = [];

      // Add evolution files
      if (medicalOrderFiles) {
        medicalOrderFiles.forEach(file => {
          if (file.name.includes(patientId)) {
            const { data } = supabase.storage
              .from('medical-orders')
              .getPublicUrl(`final-evolutions/${file.name}`);
            
            files.push({
              id: file.name,
              name: 'Evolución Clínica Final',
              url: data.publicUrl,
              type: 'evolution',
              uploaded_date: file.created_at || new Date().toISOString()
            });
          }
        });
      }

      // Add attendance files
      if (attendanceFiles) {
        attendanceFiles.forEach(file => {
          if (file.name.includes(`${patientId}_attendance`)) {
            const { data } = supabase.storage
              .from('medical-orders')
              .getPublicUrl(`attendance/${file.name}`);
            
            files.push({
              id: file.name,
              name: 'Registro de Asistencia',
              url: data.publicUrl,
              type: 'attendance',
              uploaded_date: file.created_at || new Date().toISOString()
            });
          }
        });
      }

      setPatientFiles(files);
    } catch (error) {
      console.error('Error fetching patient files:', error);
    }
  };

  const handleViewFile = async (fileUrl: string) => {
    try {
      window.open(fileUrl, '_blank');
    } catch (error) {
      console.error('Error viewing file:', error);
      toast({
        title: "Error",
        description: "No se pudo abrir el archivo",
        variant: "destructive",
      });
    }
  };

  // Group appointments by medical order
  const groupedAppointments = completedAppointments.reduce((groups, appointment) => {
    const orderId = appointment.medical_order?.id || 'sin-orden';
    if (!groups[orderId]) {
      groups[orderId] = [];
    }
    groups[orderId].push(appointment);
    return groups;
  }, {} as Record<string, CompletedAppointment[]>);

  // Get unique medical orders for filter
  const medicalOrders = Array.from(
    new Set(completedAppointments
      .filter(apt => apt.medical_order)
      .map(apt => apt.medical_order!.id)
    )
  ).map(orderId => {
    const appointment = completedAppointments.find(apt => apt.medical_order?.id === orderId);
    return appointment?.medical_order;
  }).filter(Boolean);

  // Filter appointments based on selected order
  const getFilteredAppointments = () => {
    if (orderFilter === 'all') return groupedAppointments;
    return { [orderFilter]: groupedAppointments[orderFilter] || [] };
  };

  const filteredGroups = getFilteredAppointments();

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p>Cargando historial médico...</p>
        </CardContent>
      </Card>
    );
  }

  if (completedAppointments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historia Clínica
          </CardTitle>
          <CardDescription>
            Historial de turnos completados y archivos del paciente
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            No hay turnos completados registrados para este paciente
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historia Clínica Simplificada
        </CardTitle>
        <CardDescription>
          Visualización de turnos completados y archivos del paciente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="unified" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="unified" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historia Unificada
            </TabsTrigger>
            <TabsTrigger value="appointments" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Turnos Completados
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Archivos
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="unified" className="mt-6">
            <UnifiedMedicalHistory patientId={patientId} />
          </TabsContent>
          
          <TabsContent value="appointments" className="mt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium">Turnos Completados</h3>
                  <p className="text-sm text-muted-foreground">
                    Historial de sesiones finalizadas agrupadas por orden médica
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={orderFilter} onValueChange={setOrderFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar por orden" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-popover">
                      <SelectItem value="all">Todas las órdenes</SelectItem>
                      {medicalOrders.map((order) => (
                        <SelectItem key={order!.id} value={order!.id}>
                          {order!.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Important Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="font-medium text-blue-900 mb-2">📋 Nueva modalidad de trabajo</h4>
                <p className="text-sm text-blue-700">
                  Los evolutivos individuales por sesión ya no se cargan desde aquí. 
                  Ahora se utiliza un sistema de <strong>evolución clínica final</strong> que se carga desde el módulo de <strong>Presentaciones</strong> una vez completadas todas las sesiones.
                </p>
              </div>

              <div className="space-y-6">
                {Object.entries(filteredGroups).map(([orderId, appointments]) => (
                  <div key={orderId} className="border rounded-lg p-4">
                    {/* Medical Order Header */}
                    {orderId !== 'sin-orden' && appointments[0].medical_order ? (
                      <div className="mb-4 p-3 bg-muted/50 rounded-md">
                        <h4 className="font-semibold text-lg mb-1">
                          📋 {appointments[0].medical_order.description}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Sesiones completadas: {appointments.length} de {appointments[0].medical_order.total_sessions}
                        </p>
                      </div>
                    ) : (
                      <div className="mb-4 p-3 bg-muted/50 rounded-md">
                        <h4 className="font-semibold text-lg">
                          Consultas sin orden médica específica
                        </h4>
                      </div>
                    )}

                    {/* Appointments List */}
                    <div className="space-y-3">
                      {appointments.map((appointment, index) => (
                        <div key={appointment.id} className="border rounded-md p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  {orderId !== 'sin-orden' ? `Sesión ${index + 1}` : 'Consulta'}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(appointment.appointment_date), 'PPP', { locale: es })}
                                </span>
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                  {appointment.appointment_time}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 mb-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  Dr. {appointment.doctor.profile.first_name} {appointment.doctor.profile.last_name}
                                </span>
                                <Badge 
                                  variant="secondary" 
                                  style={{ backgroundColor: appointment.doctor.specialty.color + '20', color: appointment.doctor.specialty.color }}
                                >
                                  {appointment.doctor.specialty.name}
                                </Badge>
                              </div>

                              {appointment.reason && (
                                <p className="text-sm text-muted-foreground mb-1">
                                  <strong>Motivo:</strong> {appointment.reason}
                                </p>
                              )}
                              
                              {appointment.diagnosis && (
                                <p className="text-sm text-muted-foreground mb-1">
                                  <strong>Diagnóstico:</strong> {appointment.diagnosis}
                                </p>
                              )}

                              {appointment.treatment_plan && (
                                <p className="text-sm text-muted-foreground">
                                  <strong>Tratamiento:</strong> {appointment.treatment_plan}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="files" className="mt-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Archivos del Paciente</h3>
                <p className="text-sm text-muted-foreground">
                  Documentos y archivos relacionados con el tratamiento
                </p>
              </div>

              {patientFiles.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay archivos cargados</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {patientFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Subido el {format(new Date(file.uploaded_date), 'PPP', { locale: es })}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewFile(file.url)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}