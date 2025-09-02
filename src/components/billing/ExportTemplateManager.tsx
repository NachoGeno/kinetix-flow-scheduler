import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBilling } from "@/hooks/useBilling";
import { useToast } from "@/hooks/use-toast";

const templateSchema = z.object({
  obraSocialId: z.string().min(1, "Debe seleccionar una obra social"),
  templateName: z.string().min(1, "Nombre de plantilla requerido"),
  columnConfig: z.array(z.object({
    field: z.string(),
    label: z.string(),
    order: z.number(),
  })),
});

type TemplateFormData = z.infer<typeof templateSchema>;

const AVAILABLE_FIELDS = [
  { value: "patient_name", label: "Nombre del Paciente" },
  { value: "patient_dni", label: "DNI del Paciente" },
  { value: "order_number", label: "Número de Orden" },
  { value: "order_description", label: "Descripción de Orden" },
  { value: "total_sessions", label: "Sesiones Totales" },
  { value: "sessions_completed", label: "Sesiones Completadas" },
  { value: "completion_date", label: "Fecha de Finalización" },
  { value: "professional_name", label: "Nombre del Profesional" },
  { value: "diagnosis", label: "Diagnóstico" },
];

export function ExportTemplateManager() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { 
    obrasSociales, 
    getExportTemplates, 
    createExportTemplate, 
    updateExportTemplate,
    deleteExportTemplate 
  } = useBilling();
  const { toast } = useToast();

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      templateName: "",
      columnConfig: [],
    },
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await getExportTemplates();
      setTemplates(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar las plantillas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    form.reset({
      templateName: "",
      columnConfig: [],
    });
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (template: any) => {
    form.reset({
      obraSocialId: template.obra_social_art_id,
      templateName: template.template_name,
      columnConfig: template.column_config || [],
    });
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("¿Está seguro de eliminar esta plantilla?")) return;
    
    try {
      await deleteExportTemplate(templateId);
      await loadTemplates();
      toast({
        title: "Plantilla eliminada",
        description: "La plantilla ha sido eliminada exitosamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar la plantilla",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: TemplateFormData) => {
    try {
      if (editingTemplate) {
        await updateExportTemplate(editingTemplate.id, data);
        toast({
          title: "Plantilla actualizada",
          description: "La plantilla ha sido actualizada exitosamente",
        });
      } else {
        await createExportTemplate(data);
        toast({
          title: "Plantilla creada",
          description: "La plantilla ha sido creada exitosamente",
        });
      }
      
      setIsDialogOpen(false);
      await loadTemplates();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al guardar la plantilla",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando plantillas...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Plantillas de Exportación
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Plantilla
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}
                </DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="obraSocialId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Obra Social / ART</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione una obra social" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {obrasSociales?.map((obra) => (
                                <SelectItem key={obra.id} value={obra.id}>
                                  {obra.nombre}
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
                      name="templateName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de Plantilla</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Plantilla OSDE" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <FormLabel>Configuración de Columnas</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Configure qué campos incluir y en qué orden aparecerán en el Excel
                    </p>
                    {/* TODO: Add dynamic column configuration component */}
                    <div className="p-4 border rounded-md">
                      <p className="text-sm text-muted-foreground">
                        Configurador de columnas - próximamente disponible
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingTemplate ? "Actualizar" : "Crear"} Plantilla
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Obra Social</TableHead>
                <TableHead>Campos Configurados</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No hay plantillas configuradas
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      {template.template_name}
                    </TableCell>
                    
                    <TableCell>
                      <div>
                        <p>{template.obra_social_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {template.obra_social_tipo}
                        </p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {template.column_config?.length || 0} campos
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}