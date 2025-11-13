import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePaginatedPatients } from '@/hooks/usePaginatedPatients';
import { useDebounce } from '@/hooks/useDebounce';

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  doctorName: string;
  date: Date;
  time: string;
  appointmentDuration: number;
  onSuccess: () => void;
}

const formSchema = z.object({
  patient_id: z.string().min(1, 'Debe seleccionar un paciente'),
  reason: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function CreateAppointmentDialog({
  open,
  onOpenChange,
  doctorId,
  doctorName,
  date,
  time,
  appointmentDuration,
  onSuccess,
}: CreateAppointmentDialogProps) {
  const { user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  
  const debouncedSearchTerm = useDebounce(patientSearchTerm, 300);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_id: '',
      reason: '',
    },
  });

  // Obtener pacientes activos con búsqueda en tiempo real
  const { data: patientsData, isLoading: isLoadingPatients } = usePaginatedPatients({
    searchTerm: debouncedSearchTerm,
    page: 1,
    limit: 100
  });

  const patients = patientsData?.patients || [];
  
  // Verificar estado de autenticación
  const isAuthReady = !!user && !!profile?.organization_id;

  const onSubmit = async (values: FormData) => {
    if (!profile?.organization_id) {
      toast.error('Error de organización');
      return;
    }

    setIsSubmitting(true);

    try {
      // Verificar que el slot siga disponible
      const { data: existingAppointment } = await supabase
        .from('appointments')
        .select('id')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', format(date, 'yyyy-MM-dd'))
        .eq('appointment_time', `${time}:00`)
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (existingAppointment) {
        toast.error('Este horario ya fue ocupado por otro turno');
        setIsSubmitting(false);
        return;
      }

      // Crear el turno
      const { data: newAppointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          patient_id: values.patient_id,
          doctor_id: doctorId,
          appointment_date: format(date, 'yyyy-MM-dd'),
          appointment_time: `${time}:00`,
          duration_minutes: appointmentDuration,
          reason: values.reason || null,
          status: 'scheduled',
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      toast.success('Turno creado exitosamente');
      form.reset();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      toast.error(error.message || 'Error al crear el turno');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPatient = patients.find(p => p.id === form.watch('patient_id'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Crear Turno</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {format(date, "EEEE d 'de' MMMM", { locale: es })} a las {time}
            <br />
            <span className="font-medium">Profesional: {doctorName}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Selector de Paciente */}
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Paciente *</FormLabel>
                  <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            'w-full justify-between border-border',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {selectedPatient
                            ? `${selectedPatient.profile?.first_name} ${selectedPatient.profile?.last_name}`
                            : 'Seleccionar paciente...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 border-border bg-popover">
                      <div className="p-2 border-b bg-background">
                        <Input
                          placeholder="Buscar por nombre, apellido o DNI..."
                          value={patientSearchTerm}
                          onChange={(e) => setPatientSearchTerm(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <Command>
                        <CommandList>
                          {!isAuthReady ? (
                            <div className="p-4 text-sm text-center text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                              Esperando autenticación...
                            </div>
                          ) : isLoadingPatients ? (
                            <div className="p-4 text-sm text-center text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                              Buscando pacientes...
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>
                                No se encontraron pacientes.
                                {debouncedSearchTerm && (
                                  <p className="text-xs mt-1 text-muted-foreground">
                                    Intenta con otro término de búsqueda.
                                  </p>
                                )}
                              </CommandEmpty>
                              <CommandGroup>
                                {patients.map((patient: any) => (
                                  <CommandItem
                                    key={patient.id}
                                    value={`${patient.profile?.first_name} ${patient.profile?.last_name} ${patient.profile?.dni || ''}`}
                                    onSelect={() => {
                                      field.onChange(patient.id);
                                      setPatientSearchOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        patient.id === field.value ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium text-foreground">
                                        {patient.profile?.first_name} {patient.profile?.last_name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {patient.profile?.dni && `DNI: ${patient.profile.dni} • `}
                                        {patient.obra_social_art?.nombre || 'Particular'}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo de Motivo */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Motivo de consulta</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Opcional"
                      className="resize-none border-border bg-background"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="flex-1 border-border"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Turno
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
