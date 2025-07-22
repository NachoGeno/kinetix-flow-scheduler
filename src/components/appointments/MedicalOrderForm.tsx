import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  patient_id: z.string().min(1, 'Selecciona un paciente'),
  doctor_name: z.string().min(1, 'Ingresa el nombre del médico que dio la orden'),
  description: z.string().min(1, 'Describe la indicación médica'),
  instructions: z.string().optional(),
  sessions_count: z.number().min(1, 'Debe tener al menos 1 sesión').max(50, 'Máximo 50 sesiones'),
  obra_social_art_id: z.string().optional(),
  art_provider: z.string().optional(),
  art_authorization_number: z.string().optional(),
});

interface Doctor {
  id: string;
  profile: {
    first_name: string;
    last_name: string;
  };
  specialty: {
    name: string;
  };
}

interface Patient {
  id: string;
  profile: {
    first_name: string;
    last_name: string;
    dni: string | null;
  };
  obra_social_art?: {
    id: string;
    nombre: string;
    tipo: string;
  } | null;
}

interface ObraSocial {
  id: string;
  nombre: string;
  tipo: 'obra_social' | 'art';
}

interface MedicalOrderFormProps {
  onSuccess?: (order: any) => void;
  onCancel?: () => void;
  selectedPatient?: string;
  editOrder?: any;
}

export default function MedicalOrderForm({ onSuccess, onCancel, selectedPatient, editOrder }: MedicalOrderFormProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPatientData, setSelectedPatientData] = useState<Patient | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_id: selectedPatient || editOrder?.patient_id || '',
      doctor_name: editOrder?.doctor_name || '',
      description: editOrder?.description || '',
      instructions: editOrder?.instructions || '',
      sessions_count: editOrder?.total_sessions || 1,
      obra_social_art_id: editOrder?.obra_social_art_id || '',
      art_provider: editOrder?.art_provider || '',
      art_authorization_number: editOrder?.art_authorization_number || '',
    },
  });

  useEffect(() => {
    fetchPatients();
    fetchObrasSociales();
  }, []);

  // Watch for patient selection changes
  const watchedPatientId = form.watch('patient_id');
  useEffect(() => {
    if (watchedPatientId) {
      const patient = patients.find(p => p.id === watchedPatientId);
      setSelectedPatientData(patient || null);
      
      // Auto-fill obra social if patient has one
      if (patient?.obra_social_art?.id && !form.getValues('obra_social_art_id')) {
        form.setValue('obra_social_art_id', patient.obra_social_art.id);
      }
    }
  }, [watchedPatientId, patients, form]);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id,
          profile:profiles(first_name, last_name),
          specialty:specialties(name)
        `)
        .eq('is_active', true);

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los doctores",
        variant: "destructive",
      });
    }
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          profile:profiles(first_name, last_name, dni),
          obra_social_art:obras_sociales_art(id, nombre, tipo)
        `)
        .order('profile(first_name)', { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive",
      });
    }
  };

  const fetchObrasSociales = async () => {
    try {
      const { data, error } = await supabase
        .from('obras_sociales_art')
        .select('id, nombre, tipo')
        .eq('is_active', true)
        .order('nombre');

      if (error) throw error;
      setObrasSociales(data || []);
    } catch (error) {
      console.error('Error fetching obras sociales:', error);
    }
  };

  const handleFileUpload = async (orderId: string) => {
    if (!selectedFile) return null;

    try {
      setUploading(true);
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${orderId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('medical-orders')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      return {
        attachment_url: fileName,
        attachment_name: selectedFile.name,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "No se pudo subir el archivo",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);

      const orderData = {
        doctor_name: values.doctor_name,
        patient_id: values.patient_id,
        description: values.description,
        instructions: values.instructions || null,
        order_type: 'prescription' as const,
        urgent: false,
        completed: editOrder ? editOrder.completed : false,
        obra_social_art_id: values.obra_social_art_id || null,
        art_provider: values.art_provider || null,
        art_authorization_number: values.art_authorization_number || null,
        total_sessions: values.sessions_count,
        sessions_used: editOrder ? editOrder.sessions_used : 0,
      };

      let data, error;

      if (editOrder) {
        // Actualizar orden existente
        const updateResult = await supabase
          .from('medical_orders')
          .update(orderData)
          .eq('id', editOrder.id)
          .select()
          .single();
        
        data = updateResult.data;
        error = updateResult.error;
      } else {
        // Crear nueva orden
        const insertResult = await supabase
          .from('medical_orders')
          .insert(orderData)
          .select()
          .single();
        
        data = insertResult.data;
        error = insertResult.error;
      }

      if (error) throw error;

      // Subir archivo si se seleccionó uno
      if (selectedFile) {
        const fileData = await handleFileUpload(data.id);
        if (fileData) {
          const { error: updateError } = await supabase
            .from('medical_orders')
            .update(fileData)
            .eq('id', data.id);

          if (updateError) {
            console.error('Error updating file info:', updateError);
          }
        }
      }

      toast({
        title: "Éxito",
        description: editOrder ? "Orden médica actualizada correctamente" : "Orden médica creada correctamente",
      });

      // Crear el objeto de orden con la información de sesiones
      const orderWithSessions = {
        ...data,
        sessions_count: values.sessions_count,
      };

      form.reset();
      setSelectedFile(null);
      onSuccess?.(orderWithSessions);
    } catch (error) {
      console.error('Error saving medical order:', error);
      toast({
        title: "Error",
        description: editOrder ? "No se pudo actualizar la orden médica" : "No se pudo crear la orden médica",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Mostrar información del paciente seleccionado
  const selectedPatientInfo = patients.find(p => p.id === selectedPatient);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {selectedPatient && selectedPatientInfo && (
          <div className="p-3 bg-muted rounded-lg">
            <h4 className="font-semibold text-sm">Paciente</h4>
            <p className="text-sm text-muted-foreground">
              {selectedPatientInfo.profile.first_name} {selectedPatientInfo.profile.last_name}
              {selectedPatientInfo.profile.dni && (
                <span className="ml-2">DNI: {selectedPatientInfo.profile.dni}</span>
              )}
            </p>
          </div>
        )}

        <FormField
          control={form.control}
          name="patient_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Paciente</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un paciente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.profile.first_name} {patient.profile.last_name}
                        {patient.profile.dni && (
                          <span className="ml-2 text-muted-foreground">
                            DNI: {patient.profile.dni}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="doctor_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Médico que emitió la orden</FormLabel>
              <FormControl>
                <Input
                  placeholder="Nombre del médico..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Indicación Médica</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe la indicación médica..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instrucciones adicionales (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Instrucciones específicas para el tratamiento..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sessions_count"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad de Sesiones</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="obra_social_art_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Obra Social / ART</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una obra social..." />
                  </SelectTrigger>
                  <SelectContent>
                    {obrasSociales.map((obra) => (
                      <SelectItem key={obra.id} value={obra.id}>
                        {obra.nombre} ({obra.tipo === 'obra_social' ? 'Obra Social' : 'ART'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
              {selectedPatientData?.obra_social_art && (
                <p className="text-sm text-muted-foreground">
                  Obra social del paciente: {selectedPatientData.obra_social_art.nombre}
                </p>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="art_provider"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ART/Obra Social (manual)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Solo si no está en la lista anterior..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="art_authorization_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de Autorización</FormLabel>
              <FormControl>
                <Input
                  placeholder="Número de autorización ART/Obra Social..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">Archivo Adjunto (opcional)</label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="cursor-pointer"
          />
          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              Archivo seleccionado: {selectedFile.name}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={loading || uploading}>
            {loading ? (editOrder ? 'Actualizando...' : 'Creando...') : (editOrder ? 'Actualizar Orden Médica' : 'Crear Orden Médica')}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}