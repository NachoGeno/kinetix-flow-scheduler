import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const novedadSchema = z.object({
  contenido: z.string().min(10, "El contenido debe tener al menos 10 caracteres"),
  fecha: z.string().min(1, "La fecha es requerida"),
  turno: z.enum(["mañana", "tarde", "completo"]),
  categoria: z.enum(["tecnica", "administrativa", "medica", "urgente"]),
  urgente: z.boolean().default(false),
});

type NovedadFormValues = z.infer<typeof novedadSchema>;

interface NovedadesFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovedadesForm({ open, onOpenChange, onSuccess }: NovedadesFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<NovedadFormValues>({
    resolver: zodResolver(novedadSchema),
    defaultValues: {
      fecha: format(new Date(), "yyyy-MM-dd"),
      turno: "completo",
      categoria: "administrativa",
      urgente: false,
    },
  });

  const watchCategoria = watch("categoria");
  const watchUrgente = watch("urgente");

  const getCategoryColor = (categoria: string) => {
    switch (categoria) {
      case "tecnica": return "bg-blue-100 text-blue-800 border-blue-200";
      case "administrativa": return "bg-gray-100 text-gray-800 border-gray-200";
      case "medica": return "bg-green-100 text-green-800 border-green-200";
      case "urgente": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const onSubmit = async (data: NovedadFormValues) => {
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
      const { error } = await supabase
        .from("novedades")
        .insert({
          contenido: data.contenido,
          fecha: data.fecha,
          turno: data.turno,
          categoria: data.categoria,
          urgente: data.urgente,
          autor_id: profile.id, // Volver a usar profile.id
        });

      if (error) throw error;

      toast({
        title: "¡Éxito!",
        description: "Novedad creada correctamente",
      });

      reset();
      onSuccess();
    } catch (error: any) {
      console.error("Error creating novedad:", error);
      toast({
        title: "Error",
        description: error.message || "Error al crear la novedad",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Nueva Novedad
          </DialogTitle>
          <DialogDescription>
            Comparte información importante con el equipo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                {...register("fecha")}
                className={errors.fecha ? "border-destructive" : ""}
              />
              {errors.fecha && (
                <p className="text-sm text-destructive">{errors.fecha.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="turno">Turno</Label>
              <Select value={watch("turno")} onValueChange={(value) => setValue("turno", value as any)}>
                <SelectTrigger className={errors.turno ? "border-destructive" : ""}>
                  <SelectValue placeholder="Seleccionar turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mañana">Mañana</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="completo">Completo</SelectItem>
                </SelectContent>
              </Select>
              {errors.turno && (
                <p className="text-sm text-destructive">{errors.turno.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoría</Label>
            <Select value={watch("categoria")} onValueChange={(value) => setValue("categoria", value as any)}>
              <SelectTrigger className={errors.categoria ? "border-destructive" : ""}>
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="administrativa">Administrativa</SelectItem>
                <SelectItem value="tecnica">Técnica</SelectItem>
                <SelectItem value="medica">Médica</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
            {errors.categoria && (
              <p className="text-sm text-destructive">{errors.categoria.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="urgente"
              checked={watchUrgente}
              onCheckedChange={(checked) => setValue("urgente", !!checked)}
            />
            <Label htmlFor="urgente" className="text-sm font-medium">
              Marcar como urgente
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contenido">Contenido</Label>
            <Textarea
              id="contenido"
              placeholder="Escribe aquí el contenido de la novedad..."
              rows={6}
              {...register("contenido")}
              className={errors.contenido ? "border-destructive" : ""}
            />
            {errors.contenido && (
              <p className="text-sm text-destructive">{errors.contenido.message}</p>
            )}
          </div>

          {/* Preview */}
          <Card className="bg-accent/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Vista previa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(watchCategoria)}`}>
                  {watchCategoria?.charAt(0).toUpperCase() + watchCategoria?.slice(1)}
                </div>
                {watchUrgente && (
                  <div className="px-2 py-1 rounded-full text-xs font-medium bg-red-600 text-white">
                    ¡URGENTE!
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {watch("contenido") || "El contenido aparecerá aquí..."}
              </p>
            </CardContent>
          </Card>

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
              {isSubmitting ? "Guardando..." : "Crear Novedad"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}