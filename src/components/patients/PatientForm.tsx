import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const patientSchema = z.object({
  first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  last_name: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  dni: z.string().min(7, 'El DNI debe tener al menos 7 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  insurance_provider: z.string().optional(),
  insurance_number: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PatientForm({ onSuccess, onCancel }: PatientFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      dni: '',
      email: '',
      phone: '',
      date_of_birth: '',
      insurance_provider: '',
      insurance_number: '',
    },
  });

  const onSubmit = async (data: PatientFormData) => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'doctor')) {
      toast({
        title: "Error",
        description: "No tienes permisos para crear pacientes",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Verificar si ya existe un paciente con el mismo DNI
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('dni', data.dni)
        .eq('role', 'patient')
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing patient:', checkError);
        toast({
          title: "Error",
          description: "Error al verificar datos existentes",
          variant: "destructive",
        });
        return;
      }

      if (existingProfile) {
        toast({
          title: "Error",
          description: "Ya existe un paciente con este DNI registrado. Por favor, verifique los datos.",
          variant: "destructive",
        });
        return;
      }

      // Crear perfil directamente sin crear usuario en auth
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: null, // Null para pacientes que no requieren autenticación
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          dni: data.dni,
          phone: data.phone,
          date_of_birth: data.date_of_birth || null,
          role: 'patient'
        })
        .select()
        .single();

      if (profileError) {
        if (profileError.message.includes('duplicate key') || profileError.message.includes('already exists')) {
          toast({
            title: "Error",
            description: "Ya existe un paciente con este email o DNI",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: `Error al crear perfil: ${profileError.message}`,
            variant: "destructive",
          });
        }
        return;
      }

      if (!profileData) {
        toast({
          title: "Error",
          description: "No se pudo crear el perfil",
          variant: "destructive",
        });
        return;
      }

      // Crear registro de paciente
      const { error: patientError } = await supabase
        .from('patients')
        .insert({
          profile_id: profileData.id,
          insurance_provider: data.insurance_provider || null,
          insurance_number: data.insurance_number || null,
        });

      if (patientError) {
        toast({
          title: "Error",
          description: `Error al crear paciente: ${patientError.message}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Éxito",
        description: "Paciente creado exitosamente",
      });

      onSuccess();
    } catch (error) {
      console.error('Error creating patient:', error);
      toast({
        title: "Error",
        description: "Error inesperado al crear el paciente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Nuevo Paciente</CardTitle>
        <CardDescription>
          Completa la información del nuevo paciente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre *</Label>
              <Input
                id="first_name"
                {...form.register('first_name')}
                disabled={loading}
              />
              {form.formState.errors.first_name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.first_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido *</Label>
              <Input
                id="last_name"
                {...form.register('last_name')}
                disabled={loading}
              />
              {form.formState.errors.last_name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.last_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dni">DNI *</Label>
              <Input
                id="dni"
                {...form.register('dni')}
                disabled={loading}
              />
              {form.formState.errors.dni && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.dni.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                disabled={loading}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Celular</Label>
              <Input
                id="phone"
                {...form.register('phone')}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Fecha de Nacimiento</Label>
              <Input
                id="date_of_birth"
                type="date"
                {...form.register('date_of_birth')}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance_provider">Obra Social / ART</Label>
              <Input
                id="insurance_provider"
                {...form.register('insurance_provider')}
                disabled={loading}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="insurance_number">Número de Afiliado</Label>
              <Input
                id="insurance_number"
                {...form.register('insurance_number')}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Paciente'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}