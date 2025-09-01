import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const rescheduleSchema = z.object({
  appointment_date: z.string().min(1, "La fecha es requerida"),
  appointment_time: z.string().min(1, "La hora es requerida"),
  doctor_id: z.string().optional(),
  reschedule_reason: z.string().min(5, "El motivo debe tener al menos 5 caracteres"),
});

type RescheduleFormValues = z.infer<typeof rescheduleSchema>;

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  reason: string;
  patient_id: string;
  doctor_id: string;
  duration_minutes?: number;
  patient: {
    id: string;
    profile: {
      first_name: string;
      last_name: string;
    };
  };
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
}

interface RescheduleAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment;
  onSuccess: () => void;
}

export function RescheduleAppointmentDialog({ 
  open, 
  onOpenChange, 
  appointment, 
  onSuccess 
}: RescheduleAppointmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const { toast } = useToast();
  const { profile } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RescheduleFormValues>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: {
      appointment_date: "",
      appointment_time: "",
      doctor_id: appointment.doctor_id,
      reschedule_reason: "",
    },
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      reset({
        appointment_date: "",
        appointment_time: "",
        doctor_id: appointment.doctor_id,
        reschedule_reason: "",
      });
    }
  }, [open, appointment.doctor_id, reset]);

  // Fetch available doctors
  React.useEffect(() => {
    const fetchDoctors = async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id,
          profile:profiles(first_name, last_name),
          specialty:specialties(name)
        `)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching doctors:', error);
      } else {
        setDoctors(data || []);
      }
    };

    if (open) {
      fetchDoctors();
    }
  }, [open]);

  const canReschedule = () => {
    return appointment.status === 'scheduled' || 
           appointment.status === 'confirmed' || 
           appointment.status === 'no_show' ||
           appointment.status === 'no_show_rescheduled';
  };

  const onSubmit = async (data: RescheduleFormValues) => {
    if (!profile?.id) {
      toast({
        title: "Error",
        description: "No se pudo identificar el usuario",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the new rescheduled appointment
      // The trigger handle_appointment_reschedule will automatically update the original appointment
      const { data: newAppointment, error: insertError } = await supabase
        .from("appointments")
        .insert({
          appointment_date: data.appointment_date,
          appointment_time: data.appointment_time,
          patient_id: appointment.patient_id,
          doctor_id: data.doctor_id || appointment.doctor_id,
          reason: appointment.reason,
          status: 'scheduled',
          rescheduled_from_id: appointment.id,
          rescheduled_by: profile.id,
          reschedule_reason: data.reschedule_reason,
          duration_minutes: appointment.duration_minutes || 30,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating rescheduled appointment:", insertError);
        throw insertError;
      }

      toast({
        title: "¡Éxito!",
        description: "Turno reprogramado correctamente. El turno original ha sido liberado y se creó un nuevo turno.",
      });

      reset();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error rescheduling appointment:", error);
      toast({
        title: "Error",
        description: error.message || "Error al reprogramar el turno. Verifica los permisos o contacta al administrador.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const getStatusColor = (status: string) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      no_show: 'bg-gray-100 text-gray-800',
      no_show_rescheduled: 'bg-orange-100 text-orange-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      scheduled: 'Programada',
      confirmed: 'Confirmada',
      no_show: 'Ausente',
      no_show_rescheduled: 'Ausente - Reprogramado',
    };
    return labels[status as keyof typeof labels] || status;
  };

  if (!canReschedule()) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              No se puede reprogramar
            </DialogTitle>
            <DialogDescription>
              Solo se pueden reprogramar turnos que estén programados, confirmados o marcados como no asistidos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Reprogramar Turno
          </DialogTitle>
          <DialogDescription>
            Genera un nuevo turno y marca el actual como reprogramado
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Current appointment info */}
          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Turno Original</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {appointment.patient.profile.first_name} {appointment.patient.profile.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Dr. {appointment.doctor.profile.first_name} {appointment.doctor.profile.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {appointment.doctor.specialty.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {format(new Date(appointment.appointment_date), "dd/MM/yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {appointment.appointment_time}
                  </p>
                  <Badge className={getStatusColor(appointment.status)} variant="secondary">
                    {getStatusLabel(appointment.status)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointment_date">Nueva Fecha</Label>
              <Input
                id="appointment_date"
                type="date"
                {...register("appointment_date")}
                className={errors.appointment_date ? "border-destructive" : ""}
              />
              {errors.appointment_date && (
                <p className="text-sm text-destructive">{errors.appointment_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="appointment_time">Nueva Hora</Label>
              <Input
                id="appointment_time"
                type="time"
                {...register("appointment_time")}
                className={errors.appointment_time ? "border-destructive" : ""}
              />
              {errors.appointment_time && (
                <p className="text-sm text-destructive">{errors.appointment_time.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doctor_id">Profesional (opcional - cambiar si es necesario)</Label>
            <Select 
              value={watch("doctor_id")} 
              onValueChange={(value) => setValue("doctor_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar profesional" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    Dr. {doctor.profile.first_name} {doctor.profile.last_name} - {doctor.specialty.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reschedule_reason">Motivo de la reprogramación</Label>
            <Textarea
              id="reschedule_reason"
              placeholder="Explica por qué se reprograma este turno..."
              {...register("reschedule_reason")}
              className={errors.reschedule_reason ? "border-destructive" : ""}
            />
            {errors.reschedule_reason && (
              <p className="text-sm text-destructive">{errors.reschedule_reason.message}</p>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Nota:</strong> Al reprogramar, el turno original será marcado como "Reprogramado" 
              y se creará un nuevo turno con los datos actualizados. La sesión no será descontada 
              de la orden médica.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Reprogramando..." : "Reprogramar Turno"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}