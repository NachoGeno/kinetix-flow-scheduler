import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  ClipboardList, 
  FileSignature, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Upload,
  Send,
  Filter
} from "lucide-react";
import { toast } from "sonner";

interface PatientPresentation {
  patient_id: string;
  patient_name: string;
  medical_order_id: string;
  medical_order_attachment: string | null;
  has_clinical_evolution: boolean;
  has_attendance_file: boolean;
  attendance_file_url: string | null;
  is_complete: boolean;
}

export default function Presentaciones() {
  const [selectedObraSocial, setSelectedObraSocial] = useState<string>("");
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [attendanceFiles, setAttendanceFiles] = useState<Record<string, File>>({});

  // Fetch obras sociales
  const { data: obrasSociales } = useQuery({
    queryKey: ["obras-sociales-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras_sociales_art")
        .select("id, nombre, tipo")
        .eq("is_active", true)
        .order("nombre");
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch patients with presentations data
  const { data: presentations, refetch } = useQuery({
    queryKey: ["presentations", selectedObraSocial],
    queryFn: async () => {
      if (!selectedObraSocial) return [];

      console.log("🔍 Buscando pacientes para obra social:", selectedObraSocial);

      const { data, error } = await supabase
        .from("patients")
        .select(`
          id,
          profile_id,
          obra_social_art_id,
          profiles(first_name, last_name),
          medical_orders!inner(
            id,
            attachment_url,
            total_sessions,
            completed
          ),
          unified_medical_histories!inner(
            id,
            template_data
          ),
          appointments(
            id,
            status
          )
        `)
        .eq("obra_social_art_id", selectedObraSocial)
        .eq("is_active", true);

      if (error) {
        console.error("❌ Error consultando pacientes:", error);
        throw error;
      }

      console.log("📋 Datos obtenidos de la consulta:", data);

      // Transform data to include presentation status
      console.log("🔄 Filtrando pacientes con órdenes médicas...");
      const patientsWithOrders = data.filter(patient => {
        const hasOrders = patient.medical_orders && patient.medical_orders.length > 0;
        console.log(`👤 ${patient.profiles?.first_name} ${patient.profiles?.last_name}: ${hasOrders ? '✅ Tiene órdenes' : '❌ Sin órdenes'}`);
        return hasOrders;
      });

      console.log("👥 Pacientes con órdenes médicas:", patientsWithOrders.length);

      const transformedData: PatientPresentation[] = await Promise.all(patientsWithOrders.map(async patient => {
        console.log(`🔍 Procesando paciente: ${patient.profiles?.first_name} ${patient.profiles?.last_name}`);
        const medicalOrder = patient.medical_orders?.[0];
        const unifiedHistory = patient.unified_medical_histories?.[0];
        const totalSessions = medicalOrder?.total_sessions || 0;
        
        // Count completed appointments for this medical order
        const completedAppointments = patient.appointments?.filter(app => 
          app.status === 'completed'
        ).length || 0;
        
        // Check if final summary exists in template_data
        const templateData = unifiedHistory?.template_data;
        const hasFinalSummary = templateData && 
          typeof templateData === 'object' && 
          'final_summary' in templateData &&
          templateData.final_summary &&
          typeof templateData.final_summary === 'object';
        
        console.log(`📋 Template data:`, templateData);
        console.log(`🏁 Final summary exists:`, hasFinalSummary);
        
        // Clinical evolution is complete if:
        // 1. Medical order is marked as completed
        // 2. Final summary has been generated (automatically or manually)
        const isOrderCompleted = medicalOrder?.completed === true;
        const hasClinicalEvolution = isOrderCompleted && hasFinalSummary;
        
        console.log(`📊 ${patient.profiles?.first_name}: Orden completada=${isOrderCompleted}, Resumen final=${hasFinalSummary}, Evolutivo=${hasClinicalEvolution}`);

        // Check if attendance file exists in storage
        const attendanceFileName = `attendance/${patient.id}_attendance`;
        let hasAttendanceFile = false;
        let attendanceFileUrl = null;
        
        try {
          const { data: files } = await supabase.storage
            .from('medical-orders')
            .list('attendance', {
              search: `${patient.id}_attendance`
            });
          
          if (files && files.length > 0) {
            hasAttendanceFile = true;
            const { data } = supabase.storage
              .from('medical-orders')
              .getPublicUrl(`attendance/${files[0].name}`);
            attendanceFileUrl = data.publicUrl;
          }
        } catch (error) {
          console.error('Error checking attendance file:', error);
        }

        const result = {
          patient_id: patient.id,
          patient_name: `${patient.profiles?.first_name} ${patient.profiles?.last_name}`,
          medical_order_id: medicalOrder?.id || "",
          medical_order_attachment: medicalOrder?.attachment_url || null,
          has_clinical_evolution: hasClinicalEvolution,
          has_attendance_file: hasAttendanceFile,
          attendance_file_url: attendanceFileUrl,
          is_complete: (medicalOrder?.attachment_url ? true : false) && hasClinicalEvolution && hasAttendanceFile
        };

        console.log(`✅ Resultado para ${patient.profiles?.first_name}:`, result);
        return result;
      }));

      console.log("🎯 Datos transformados finales:", transformedData);
      return transformedData;
    },
    enabled: !!selectedObraSocial
  });

  const handleFileUpload = async (patientId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${patientId}_attendance.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('medical-orders')
        .upload(`attendance/${fileName}`, file, {
          upsert: true
        });

      if (error) throw error;

      setAttendanceFiles(prev => ({ ...prev, [patientId]: file }));
      toast.success("Archivo de asistencia cargado correctamente");
      refetch();
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Error al cargar el archivo");
    }
  };

  const markAsReady = async (patientId: string) => {
    // Logic to mark presentation as ready to send
    toast.success("Presentación marcada como lista para enviar");
  };

  const viewMedicalOrderFile = async (attachmentUrl: string) => {
    try {
      // El attachmentUrl ya viene con la ruta completa desde la base de datos
      const { data } = supabase.storage
        .from('medical-orders')
        .getPublicUrl(attachmentUrl);
      
      // Verificar que la URL se genere correctamente
      console.log('Generated URL:', data.publicUrl);
      
      if (data.publicUrl) {
        window.open(data.publicUrl, '_blank');
      } else {
        toast.error("No se pudo generar la URL del archivo");
      }
    } catch (error) {
      console.error("Error viewing medical order file:", error);
      toast.error("Error al abrir el archivo");
    }
  };

  const exportPresentation = async () => {
    // Logic to export complete presentation
    toast.success("Exportando presentación...");
  };

  const filteredPresentations = presentations?.filter(p => 
    !showIncompleteOnly || !p.is_complete
  ) || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Presentaciones</h1>
        <Button onClick={exportPresentation} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar Presentación
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Obra Social / ART</Label>
              <Select value={selectedObraSocial} onValueChange={setSelectedObraSocial}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar obra social" />
                </SelectTrigger>
                <SelectContent>
                  {obrasSociales?.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nombre} ({obra.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="incomplete-only"
                checked={showIncompleteOnly}
                onCheckedChange={setShowIncompleteOnly}
              />
              <Label htmlFor="incomplete-only">
                Mostrar solo presentaciones incompletas
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patients List */}
      {selectedObraSocial && (
        <div className="space-y-4">
          {filteredPresentations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay pacientes para mostrar
              </CardContent>
            </Card>
          ) : (
            filteredPresentations.map((patient) => (
              <Card key={patient.patient_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{patient.patient_name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {patient.is_complete ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Completa
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Incompleta
                        </Badge>
                      )}
                      <Button
                        onClick={() => markAsReady(patient.patient_id)}
                        disabled={!patient.is_complete}
                        size="sm"
                        className="gap-1"
                      >
                        <Send className="h-3 w-3" />
                        Marcar como lista
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Medical Order */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">Orden Médica</span>
                        {patient.medical_order_attachment ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      {patient.medical_order_attachment ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full gap-1"
                          onClick={() => viewMedicalOrderFile(patient.medical_order_attachment!)}
                        >
                          <Download className="h-3 w-3" />
                          Ver escaneado
                        </Button>
                      ) : (
                        <p className="text-sm text-muted-foreground">Falta orden médica</p>
                      )}
                    </div>

                    {/* Clinical Evolution */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        <span className="font-medium">Evolutivo Clínico</span>
                        {patient.has_clinical_evolution ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      {patient.has_clinical_evolution ? (
                        <Button variant="outline" size="sm" className="w-full gap-1">
                          <Download className="h-3 w-3" />
                          Descargar PDF
                        </Button>
                      ) : (
                        <p className="text-sm text-muted-foreground">Falta historia clínica</p>
                      )}
                    </div>

                    {/* Attendance File */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileSignature className="h-4 w-4" />
                        <span className="font-medium">Asistencia</span>
                        {patient.has_attendance_file ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      {patient.has_attendance_file ? (
                        <div className="space-y-1">
                          <Button variant="outline" size="sm" className="w-full gap-1">
                            <Download className="h-3 w-3" />
                            Ver archivo
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(patient.patient_id, file);
                              }
                            }}
                            className="text-xs"
                          />
                          <p className="text-sm text-muted-foreground">Falta asistencia</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}