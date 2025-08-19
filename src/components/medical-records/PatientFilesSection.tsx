import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Download, 
  Calendar, 
  User, 
  AlertCircle,
  FileImage,
  FileCheck,
  Stethoscope,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PatientFile {
  id: string;
  name: string;
  url: string;
  type: 'orden_medica' | 'historia_clinica' | 'nota_progreso' | 'otro';
  date: string;
  uploadedBy: string;
  source: string;
  sourceId: string;
}

interface PatientFilesSectionProps {
  patientId: string;
}

const fileTypeLabels = {
  orden_medica: 'Orden Médica',
  historia_clinica: 'Historia Clínica',
  nota_progreso: 'Nota de Progreso',
  otro: 'Otro Documento'
};

const fileTypeIcons = {
  orden_medica: FileCheck,
  historia_clinica: Stethoscope,
  nota_progreso: ClipboardList,
  otro: FileText
};

export function PatientFilesSection({ patientId }: PatientFilesSectionProps) {
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDate, setFilterDate] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchPatientFiles();
  }, [patientId]);

  const fetchPatientFiles = async () => {
    try {
      setLoading(true);
      const allFiles: PatientFile[] = [];

      // Fetch files from medical_orders
      const { data: medicalOrders, error: ordersError } = await supabase
        .from('medical_orders')
        .select(`
          id,
          attachment_url,
          attachment_name,
          created_at,
          doctor_name
        `)
        .eq('patient_id', patientId)
        .not('attachment_url', 'is', null);

      if (ordersError) throw ordersError;

      medicalOrders?.forEach((order) => {
        if (order.attachment_url && order.attachment_name) {
          allFiles.push({
            id: `order_${order.id}`,
            name: order.attachment_name,
            url: order.attachment_url,
            type: 'orden_medica',
            date: order.created_at,
            uploadedBy: order.doctor_name || 'No especificado',
            source: 'Orden Médica',
            sourceId: order.id
          });
        }
      });

      // Fetch files from progress_notes
      const { data: progressNotes, error: notesError } = await supabase
        .from('progress_notes')
        .select(`
          id,
          attachment_url,
          attachment_name,
          created_at,
          created_by
        `)
        .eq('patient_id', patientId)
        .not('attachment_url', 'is', null);

      // Get profile information for progress notes creators
      const creatorIds = progressNotes?.map(note => note.created_by).filter(Boolean) || [];
      const { data: creators } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', creatorIds);

      if (notesError) throw notesError;

      progressNotes?.forEach((note) => {
        if (note.attachment_url && note.attachment_name) {
          const creator = creators?.find(c => c.id === note.created_by);
          allFiles.push({
            id: `note_${note.id}`,
            name: note.attachment_name,
            url: note.attachment_url,
            type: 'nota_progreso',
            date: note.created_at,
            uploadedBy: creator ? 
              `${creator.first_name} ${creator.last_name}` : 'No especificado',
            source: 'Nota de Progreso',
            sourceId: note.id
          });
        }
      });

      // Sort by date (newest first)
      allFiles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setFiles(allFiles);
    } catch (error) {
      console.error('Error fetching patient files:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los archivos del paciente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: PatientFile) => {
    try {
      // For Supabase storage files
      if (file.url.includes('supabase')) {
        const { data, error } = await supabase.storage
          .from('medical-orders')
          .download(file.url.split('/').pop() || '');

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // For external URLs, open in new tab
        window.open(file.url, '_blank');
      }

      toast({
        title: "Éxito",
        description: `Descargando ${file.name}`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    }
  };

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || file.type === filterType;
    const matchesDate = !filterDate || file.date.startsWith(filterDate);
    
    return matchesSearch && matchesType && matchesDate;
  });

  const getMissingDocuments = () => {
    const hasOrdenMedica = files.some(f => f.type === 'orden_medica');
    const hasHistoriaClinica = files.some(f => f.type === 'historia_clinica');
    
    const missing = [];
    if (!hasOrdenMedica) missing.push('Orden Médica');
    if (!hasHistoriaClinica) missing.push('Historia Clínica Final');
    
    return missing;
  };

  const missingDocs = getMissingDocuments();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Missing documents alert */}
      {missingDocs.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Documentos faltantes:</strong> {missingDocs.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Archivos del Paciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar archivo por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="orden_medica">Orden Médica</SelectItem>
                <SelectItem value="historia_clinica">Historia Clínica</SelectItem>
                <SelectItem value="nota_progreso">Nota de Progreso</SelectItem>
                <SelectItem value="otro">Otro Documento</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-40"
            />
          </div>

          {filteredFiles.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {files.length === 0 
                  ? 'No se encontraron archivos para este paciente'
                  : 'No hay archivos que coincidan con los filtros aplicados'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.map((file) => {
                const IconComponent = fileTypeIcons[file.type];
                
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0">
                        <IconComponent className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{file.name}</h4>
                          <Badge variant="outline" className="flex-shrink-0">
                            {fileTypeLabels[file.type]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(file.date), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {file.uploadedBy}
                          </div>
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            {file.source}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(file)}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span>Total de archivos: {files.length}</span>
                <span>Mostrando: {filteredFiles.length}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}