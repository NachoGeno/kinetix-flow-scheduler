import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, CalendarIcon, Clock, User, Phone, Mail, CreditCard, Award, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const professionalFormSchema = z.object({
  first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  last_name: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos'),
  dni: z.string().min(7, 'El DNI debe tener al menos 7 dígitos'),
  specialty_id: z.string().min(1, 'Debe seleccionar una especialidad'),
  license_number: z.string().min(1, 'El número de licencia es requerido'),
  years_experience: z.number().min(0, 'Los años de experiencia no pueden ser negativos'),
  consultation_fee: z.number().min(0, 'La tarifa no puede ser negativa'),
  bio: z.string().optional(),
  hire_date: z.date({
    required_error: 'La fecha de alta es requerida',
  }),
  work_days: z.array(z.string()).min(1, 'Debe seleccionar al menos un día de trabajo'),
  work_start_time: z.string().min(1, 'La hora de inicio es requerida'),
  work_end_time: z.string().min(1, 'La hora de fin es requerida'),
  appointment_duration: z.number().min(15, 'La duración mínima de cita es 15 minutos'),
});

type ProfessionalFormData = z.infer<typeof professionalFormSchema>;

interface Specialty {
  id: string;
  name: string;
  color: string;
}

interface Doctor {
  id: string;
  license_number: string;
  years_experience: number;
  consultation_fee: number;
  bio: string;
  is_active: boolean;
  profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    avatar_url: string;
  };
  specialty: {
    name: string;
    color: string;
  };
}

interface ProfessionalFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  doctorData?: Doctor | null;
}

const workDaysOptions = [
  { id: 'monday', label: 'Lunes' },
  { id: 'tuesday', label: 'Martes' },
  { id: 'wednesday', label: 'Miércoles' },
  { id: 'thursday', label: 'Jueves' },
  { id: 'friday', label: 'Viernes' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' },
];

export function ProfessionalForm({ onSuccess, onCancel, doctorData }: ProfessionalFormProps) {
  const [loading, setLoading] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [workDays, setWorkDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const { toast } = useToast();

  const form = useForm<ProfessionalFormData>({
    resolver: zodResolver(professionalFormSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      dni: '',
      specialty_id: '',
      license_number: '',
      years_experience: 0,
      consultation_fee: 0,
      bio: '',
      work_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      work_start_time: '08:00',
      work_end_time: '17:00',
      appointment_duration: 30,
    },
  });

  // Cargar especialidades al inicializar
  useEffect(() => {
    const fetchSpecialties = async () => {
      const { data, error } = await supabase
        .from('specialties')
        .select('*')
        .order('name');
      
      if (!error && data) {
        setSpecialties(data);
      }
    };
    
    fetchSpecialties();
  }, []);

  // Cargar datos del doctor si estamos editando
  useEffect(() => {
    if (doctorData && specialties.length > 0) {
      const specialty = specialties.find(s => s.name === doctorData.specialty.name);
      
      form.reset({
        first_name: doctorData.profile.first_name,
        last_name: doctorData.profile.last_name,
        email: doctorData.profile.email,
        phone: doctorData.profile.phone || '',
        dni: '', // No tenemos este dato en la interface actual
        specialty_id: specialty?.id || '',
        license_number: doctorData.license_number,
        years_experience: doctorData.years_experience || 0,
        consultation_fee: doctorData.consultation_fee || 0,
        bio: doctorData.bio || '',
        hire_date: new Date(), // Por defecto
        work_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        work_start_time: '08:00',
        work_end_time: '17:00',
        appointment_duration: 30,
      });
    }
  }, [doctorData, specialties, form]);

  const handleWorkDayChange = (dayId: string, checked: boolean) => {
    const updatedDays = checked 
      ? [...workDays, dayId]
      : workDays.filter(day => day !== dayId);
    
    setWorkDays(updatedDays);
    form.setValue('work_days', updatedDays);
  };

  const onSubmit = async (data: ProfessionalFormData) => {
    try {
      setLoading(true);

      if (doctorData) {
        // Modo edición - actualizar datos existentes
        // Primero obtener el profile_id del doctor
        const { data: doctorInfo, error: doctorInfoError } = await supabase
          .from('doctors')
          .select('profile_id')
          .eq('id', doctorData.id)
          .single();

        if (doctorInfoError) {
          console.error('Error obteniendo información del doctor:', doctorInfoError);
          toast({
            title: "Error",
            description: "No se pudo obtener la información del profesional",
            variant: "destructive",
          });
          return;
        }

        // Actualizar perfil
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            phone: data.phone,
            dni: data.dni,
          })
          .eq('id', doctorInfo.profile_id);

        if (profileError) {
          console.error('Error actualizando perfil:', profileError);
          toast({
            title: "Error",
            description: "No se pudo actualizar el perfil del profesional",
            variant: "destructive",
          });
          return;
        }

        // Actualizar registro de doctor
        const { error: doctorError } = await supabase
          .from('doctors')
          .update({
            specialty_id: data.specialty_id,
            license_number: data.license_number,
            years_experience: data.years_experience,
            consultation_fee: data.consultation_fee,
            bio: data.bio || null,
            hire_date: format(data.hire_date, 'yyyy-MM-dd'),
            work_days: data.work_days,
            work_start_time: data.work_start_time,
            work_end_time: data.work_end_time,
            appointment_duration: data.appointment_duration,
          })
          .eq('id', doctorData.id);

        if (doctorError) {
          console.error('Error actualizando doctor:', doctorError);
          toast({
            title: "Error",
            description: "No se pudo actualizar el registro del profesional",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Éxito",
          description: "Profesional actualizado correctamente",
        });
      } else {
        // Modo creación - crear nuevos registros
        // Crear perfil del profesional
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: null, // Para profesionales no autenticados inicialmente
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            phone: data.phone,
            dni: data.dni,
            role: 'doctor' as const,
          })
          .select()
          .single();

        if (profileError) {
          console.error('Error creando perfil:', profileError);
          toast({
            title: "Error",
            description: "No se pudo crear el perfil del profesional",
            variant: "destructive",
          });
          return;
        }

        // Crear registro de doctor
        const { error: doctorError } = await supabase
          .from('doctors')
          .insert({
            profile_id: profileData.id,
            specialty_id: data.specialty_id,
            license_number: data.license_number,
            years_experience: data.years_experience,
            consultation_fee: data.consultation_fee,
            bio: data.bio || null,
            hire_date: format(data.hire_date, 'yyyy-MM-dd'),
            work_days: data.work_days,
            work_start_time: data.work_start_time,
            work_end_time: data.work_end_time,
            appointment_duration: data.appointment_duration,
            is_active: true,
          });

        if (doctorError) {
          console.error('Error creando doctor:', doctorError);
          toast({
            title: "Error",
            description: "No se pudo crear el registro del profesional",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Éxito",
          description: "Profesional creado correctamente",
        });
      }

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {doctorData ? 'Editar Profesional' : 'Nuevo Profesional'}
        </CardTitle>
        <CardDescription>
          {doctorData 
            ? 'Modifique la información del profesional de la salud'
            : 'Complete la información del nuevo profesional de la salud'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Información Personal */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Información Personal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre *</Label>
                <Input
                  id="first_name"
                  placeholder="Nombre del profesional"
                  {...form.register('first_name')}
                  disabled={loading}
                />
                {form.formState.errors.first_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.first_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido *</Label>
                <Input
                  id="last_name"
                  placeholder="Apellido del profesional"
                  {...form.register('last_name')}
                  disabled={loading}
                />
                {form.formState.errors.last_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.last_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dni">DNI *</Label>
                <Input
                  id="dni"
                  placeholder="Número de documento"
                  {...form.register('dni')}
                  disabled={loading}
                />
                {form.formState.errors.dni && (
                  <p className="text-sm text-destructive">{form.formState.errors.dni.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@ejemplo.com"
                  {...form.register('email')}
                  disabled={loading}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono *</Label>
                <Input
                  id="phone"
                  placeholder="Número de teléfono"
                  {...form.register('phone')}
                  disabled={loading}
                />
                {form.formState.errors.phone && (
                  <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Fecha de Alta *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.watch('hire_date') && "text-muted-foreground"
                      )}
                      disabled={loading}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch('hire_date') ? (
                        format(form.watch('hire_date'), "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={form.watch('hire_date')}
                      onSelect={(date) => form.setValue('hire_date', date!)}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.hire_date && (
                  <p className="text-sm text-destructive">{form.formState.errors.hire_date.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Información Profesional */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Award className="h-4 w-4" />
              Información Profesional
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="specialty_id">Especialidad *</Label>
                <Select onValueChange={(value) => form.setValue('specialty_id', value)} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map((specialty) => (
                      <SelectItem key={specialty.id} value={specialty.id}>
                        {specialty.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.specialty_id && (
                  <p className="text-sm text-destructive">{form.formState.errors.specialty_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="license_number">Número de Licencia *</Label>
                <Input
                  id="license_number"
                  placeholder="Número de matrícula profesional"
                  {...form.register('license_number')}
                  disabled={loading}
                />
                {form.formState.errors.license_number && (
                  <p className="text-sm text-destructive">{form.formState.errors.license_number.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="years_experience">Años de Experiencia</Label>
                <Input
                  id="years_experience"
                  type="number"
                  min="0"
                  placeholder="Años de experiencia"
                  {...form.register('years_experience', { valueAsNumber: true })}
                  disabled={loading}
                />
                {form.formState.errors.years_experience && (
                  <p className="text-sm text-destructive">{form.formState.errors.years_experience.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="consultation_fee">Tarifa de Consulta</Label>
                <Input
                  id="consultation_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Tarifa por consulta"
                  {...form.register('consultation_fee', { valueAsNumber: true })}
                  disabled={loading}
                />
                {form.formState.errors.consultation_fee && (
                  <p className="text-sm text-destructive">{form.formState.errors.consultation_fee.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Biografía</Label>
              <Textarea
                id="bio"
                placeholder="Descripción profesional, formación, experiencia..."
                {...form.register('bio')}
                disabled={loading}
                rows={3}
              />
            </div>
          </div>

          {/* Horarios de Trabajo */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horarios de Trabajo
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Días de Trabajo *</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {workDaysOptions.map((day) => (
                    <div key={day.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={day.id}
                        checked={workDays.includes(day.id)}
                        onCheckedChange={(checked) => handleWorkDayChange(day.id, checked as boolean)}
                        disabled={loading}
                      />
                      <Label htmlFor={day.id} className="text-sm font-normal">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
                {form.formState.errors.work_days && (
                  <p className="text-sm text-destructive">{form.formState.errors.work_days.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="work_start_time">Hora de Inicio *</Label>
                  <Input
                    id="work_start_time"
                    type="time"
                    {...form.register('work_start_time')}
                    disabled={loading}
                  />
                  {form.formState.errors.work_start_time && (
                    <p className="text-sm text-destructive">{form.formState.errors.work_start_time.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="work_end_time">Hora de Fin *</Label>
                  <Input
                    id="work_end_time"
                    type="time"
                    {...form.register('work_end_time')}
                    disabled={loading}
                  />
                  {form.formState.errors.work_end_time && (
                    <p className="text-sm text-destructive">{form.formState.errors.work_end_time.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appointment_duration">Duración de Cita (minutos) *</Label>
                  <Select 
                    onValueChange={(value) => form.setValue('appointment_duration', parseInt(value))} 
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Duración" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="45">45 minutos</SelectItem>
                      <SelectItem value="60">60 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.appointment_duration && (
                    <p className="text-sm text-destructive">{form.formState.errors.appointment_duration.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading 
                ? (doctorData ? 'Actualizando...' : 'Creando...') 
                : (doctorData ? 'Actualizar Profesional' : 'Crear Profesional')
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}