import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const patientSchema = z.object({
  first_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  last_name: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  dni: z.string()
    .min(7, 'El DNI debe tener al menos 7 caracteres')
    .regex(/^\d+$/, 'El DNI solo puede contener números'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  obra_social_art_id: z.string().optional(),
  insurance_number: z.string().optional(),
});

import { useObrasSociales } from '@/hooks/useOptimizedData';

interface ObraSocial {
  id: string;
  nombre: string;
  tipo: 'obra_social' | 'art';
}

type PatientFormData = z.infer<typeof patientSchema>;

import { useOrganizationContext } from "@/hooks/useOrganizationContext";

interface PatientFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  patient?: {
    id: string;
    profile_id: string;
    obra_social_art_id?: string;
    insurance_number?: string;
    profile: {
      first_name: string;
      last_name: string;
      dni: string;
      email: string;
      phone: string;
      date_of_birth: string;
    };
  };
  isEditing?: boolean;
}

export default function PatientForm({ onSuccess, onCancel, patient, isEditing = false }: PatientFormProps) {
  const [loading, setLoading] = useState(false);
  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([]);
  const { toast } = useToast();
  const { profile } = useAuth();
  const { currentOrgId } = useOrganizationContext();

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      first_name: patient?.profile?.first_name || '',
      last_name: patient?.profile?.last_name || '',
      dni: patient?.profile?.dni || '',
      email: patient?.profile?.email || '',
      phone: patient?.profile?.phone || '',
      date_of_birth: patient?.profile?.date_of_birth || '',
      obra_social_art_id: patient?.obra_social_art_id || '',
      insurance_number: patient?.insurance_number || '',
    },
  });

  useEffect(() => {
    fetchObrasSociales();
  }, []);

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

  const onSubmit = async (data: PatientFormData) => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'doctor')) {
      toast({
        title: "Error",
        description: `No tienes permisos para ${isEditing ? 'editar' : 'crear'} pacientes`,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      if (isEditing && patient) {
        // Modo edición - actualizar paciente existente
        
        // Verificar si el DNI cambió y si ya existe otro paciente con ese DNI en la misma organización
        if (data.dni !== patient.profile.dni) {
          const { data: existingPatient, error: checkError } = await supabase
            .from('patients')
            .select(`
              id,
              profile:profiles!inner(id, first_name, last_name, dni)
            `)
            .eq('profiles.dni', data.dni)
            .eq('organization_id', currentOrgId)
            .neq('profile_id', patient.profile_id) // Excluir el paciente actual
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

          if (existingPatient) {
            toast({
              title: "Error",
              description: "Ya existe otro paciente con este DNI en esta organización.",
              variant: "destructive",
            });
            return;
          }
        }

        // Actualizar perfil
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            dni: data.dni,
            phone: data.phone,
            date_of_birth: data.date_of_birth || null,
          })
          .eq('id', patient.profile_id);

        if (profileError) {
          toast({
            title: "Error",
            description: `Error al actualizar perfil: ${profileError.message}`,
            variant: "destructive",
          });
          return;
        }

        // Actualizar datos del paciente
        const { error: patientError } = await supabase
          .from('patients')
          .update({
            obra_social_art_id: data.obra_social_art_id || null,
            insurance_number: data.insurance_number || null,
          })
          .eq('id', patient.id);

        if (patientError) {
          toast({
            title: "Error",
            description: `Error al actualizar paciente: ${patientError.message}`,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Éxito",
          description: "Paciente actualizado exitosamente",
        });

      } else {
        // Modo creación - crear nuevo paciente
        
        // Verificar si ya existe un paciente con el mismo DNI en la misma organización
        const { data: existingPatient, error: checkError } = await supabase
          .from('patients')
          .select(`
            id,
            profile:profiles!inner(id, first_name, last_name, dni)
          `)
          .eq('profiles.dni', data.dni)
          .eq('organization_id', currentOrgId)
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

        if (existingPatient) {
          toast({
            title: "Error",
            description: "Ya existe un paciente con este DNI en esta organización.",
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
             role: 'patient',
             organization_id: currentOrgId,
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
            obra_social_art_id: data.obra_social_art_id || null,
            insurance_number: data.insurance_number || null,
            organization_id: currentOrgId,
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
      }

      onSuccess();
    } catch (error) {
      console.error('Error creating/updating patient:', error);
      toast({
        title: "Error",
        description: `Error inesperado al ${isEditing ? 'actualizar' : 'crear'} el paciente`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditing ? 'Editar Paciente' : 'Nuevo Paciente'}</CardTitle>
        <CardDescription>
          {isEditing ? 'Modifica la información del paciente' : 'Completa la información del nuevo paciente'}
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
                inputMode="numeric"
                pattern="[0-9]*"
                onInput={(e) => {
                  const target = e.target as HTMLInputElement;
                  target.value = target.value.replace(/[^0-9]/g, '');
                }}
              />
              {form.formState.errors.dni && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.dni.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="obra_social_art_id">Obra Social / ART</Label>
              <Select
                onValueChange={(value) => form.setValue('obra_social_art_id', value)}
                value={form.watch('obra_social_art_id')}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una obra social" />
                </SelectTrigger>
                <SelectContent>
                  {obrasSociales.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nombre} ({obra.tipo === 'obra_social' ? 'Obra Social' : 'ART'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {loading ? (isEditing ? 'Actualizando...' : 'Creando...') : (isEditing ? 'Actualizar Paciente' : 'Crear Paciente')}
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