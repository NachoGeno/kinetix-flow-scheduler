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
  doctor_id: z.string().min(1, 'Selecciona el médico que dio la orden'),
  patient_id: z.string().min(1, 'Selecciona el paciente'),
  description: z.string().min(1, 'Describe la indicación médica'),
  instructions: z.string().optional(),
  sessions_count: z.number().min(1, 'Debe tener al menos 1 sesión').max(20, 'Máximo 20 sesiones'),
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
}

interface MedicalOrderFormProps {
  onSuccess?: (order: any) => void;
  onCancel?: () => void;
  selectedPatient?: string;
}

export default function MedicalOrderForm({ onSuccess, onCancel, selectedPatient }: MedicalOrderFormProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      doctor_id: '',
      patient_id: selectedPatient || '',
      description: '',
      instructions: '',
      sessions_count: 1,
    },
  });

  useEffect(() => {
    fetchDoctors();
    fetchPatients();
  }, []);

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
          profile:profiles(first_name, last_name, dni)
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('medical_orders')
        .insert({
          doctor_id: values.doctor_id,
          patient_id: values.patient_id,
          description: values.description,
          instructions: values.instructions || null,
          order_type: 'prescription',
          urgent: false,
          completed: false,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Orden médica creada correctamente",
      });

      // Crear el objeto de orden con la información de sesiones
      const orderWithSessions = {
        ...data,
        sessions_count: values.sessions_count,
      };

      form.reset();
      onSuccess?.(orderWithSessions);
    } catch (error) {
      console.error('Error creating medical order:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la orden médica",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="patient_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Paciente</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!!selectedPatient}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar paciente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.profile.first_name} {patient.profile.last_name}
                      {patient.profile.dni && (
                        <span className="text-sm text-muted-foreground ml-2">
                          (DNI: {patient.profile.dni})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="doctor_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Médico que emitió la orden</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar médico" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      Dr. {doctor.profile.first_name} {doctor.profile.last_name}
                      <span className="text-sm text-muted-foreground ml-2">
                        ({doctor.specialty.name})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Creando...' : 'Crear Orden Médica'}
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