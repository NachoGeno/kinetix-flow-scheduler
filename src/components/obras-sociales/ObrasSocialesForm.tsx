import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from '@/hooks/useOrganizationContext';

const formSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  cuit: z.string().optional(),
  tipo: z.enum(["obra_social", "art"]),
  domicilio: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  responsable_contacto: z.string().optional(),
  condicion_iva: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ObrasSocialesFormProps {
  isOpen: boolean;
  onClose: () => void;
  obraSocial?: any;
  onSuccess: () => void;
}

export function ObrasSocialesForm({
  isOpen,
  onClose,
  obraSocial,
  onSuccess,
}: ObrasSocialesFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!obraSocial;
  const { currentOrgId } = useOrganizationContext();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombre: obraSocial?.nombre || "",
      cuit: obraSocial?.cuit || "",
      tipo: obraSocial?.tipo || "obra_social",
      domicilio: obraSocial?.domicilio || "",
      telefono: obraSocial?.telefono || "",
      email: obraSocial?.email || "",
      responsable_contacto: obraSocial?.responsable_contacto || "",
      condicion_iva: obraSocial?.condicion_iva || "",
    },
  });

  const onSubmit = async (values: FormData) => {
    setIsLoading(true);
    try {
      const cleanValues = {
        nombre: values.nombre,
        tipo: values.tipo,
        email: values.email || null,
        cuit: values.cuit || null,
        domicilio: values.domicilio || null,
        telefono: values.telefono || null,
        responsable_contacto: values.responsable_contacto || null,
        condicion_iva: values.condicion_iva || null,
        organization_id: currentOrgId,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("obras_sociales_art")
          .update(cleanValues)
          .eq("id", obraSocial.id);

        if (error) throw error;
        toast.success("Obra Social / ART actualizada correctamente");
      } else {
        const { error } = await supabase
          .from("obras_sociales_art")
          .insert(cleanValues);

        if (error) throw error;
        toast.success("Obra Social / ART creada correctamente");
      }

      onSuccess();
      onClose();
      form.reset();
    } catch (error: any) {
      toast.error(error.message || "Error al guardar la Obra Social / ART");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar" : "Crear"} Obra Social / ART
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="obra_social">Obra Social</SelectItem>
                        <SelectItem value="art">ART</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cuit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CUIT</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="20-12345678-9" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+54 11 1234-5678" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="contacto@ejemplo.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsable_contacto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsable / Contacto</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nombre del responsable" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="condicion_iva"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condición de IVA</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona condición" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                        <SelectItem value="exento">Exento</SelectItem>
                        <SelectItem value="monotributo">Monotributo</SelectItem>
                        <SelectItem value="consumidor_final">Consumidor Final</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="domicilio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domicilio</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Dirección completa" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}