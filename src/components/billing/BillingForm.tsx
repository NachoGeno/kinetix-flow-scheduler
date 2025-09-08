import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Download, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useBilling } from "@/hooks/useBilling";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  obraSocialId: z.string().min(1, "Debe seleccionar una obra social"),
  periodStart: z.date({ message: "Fecha de inicio requerida" }),
  periodEnd: z.date({ message: "Fecha de fin requerida" }),
  invoiceNumber: z.string().min(1, "Número de factura requerido"),
});

type FormData = z.infer<typeof formSchema>;

export function BillingForm() {
  const [selectedPresentations, setSelectedPresentations] = useState<string[]>([]);
  const [availablePresentations, setAvailablePresentations] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  
  const { toast } = useToast();
  const { 
    obrasSociales, 
    loading,
    isGenerating,
    getCompletedPresentations, 
    createBillingInvoice,
    generateExcelFile 
  } = useBilling();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodStart: new Date(new Date().setDate(1)), // First day of current month
      periodEnd: new Date(),
    },
  });

  const watchedObraId = form.watch("obraSocialId");
  const watchedPeriodStart = form.watch("periodStart");
  const watchedPeriodEnd = form.watch("periodEnd");

  // Load presentations when obra social or period changes
  useEffect(() => {
    if (watchedObraId && watchedPeriodStart && watchedPeriodEnd) {
      loadPresentations();
    }
  }, [watchedObraId, watchedPeriodStart, watchedPeriodEnd]);

  const loadPresentations = async () => {
    try {
      const presentations = await getCompletedPresentations({
        obraSocialId: watchedObraId,
        periodStart: watchedPeriodStart,
        periodEnd: watchedPeriodEnd,
      });
      setAvailablePresentations(presentations);
      setSelectedPresentations([]); // Reset selection
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar las presentaciones",
        variant: "destructive",
      });
    }
  };

  const handlePresentationToggle = (presentationId: string) => {
    setSelectedPresentations(prev =>
      prev.includes(presentationId)
        ? prev.filter(id => id !== presentationId)
        : [...prev, presentationId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPresentations.length === availablePresentations.length) {
      setSelectedPresentations([]);
    } else {
      setSelectedPresentations(availablePresentations.map(p => p.id));
    }
  };

  const generatePreview = async (data: FormData) => {
    if (selectedPresentations.length === 0) {
      toast({
        title: "Seleccione presentaciones",
        description: "Debe seleccionar al menos una presentación para previsualizar",
        variant: "destructive",
      });
      return;
    }

    const selectedData = availablePresentations.filter(p => 
      selectedPresentations.includes(p.id)
    );

    setPreviewData({
      obraSocialId: data.obraSocialId,
      invoiceNumber: data.invoiceNumber,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      presentations: selectedData,
    });
  };

  const onSubmit = async (data: FormData) => {
    if (selectedPresentations.length === 0) {
      toast({
        title: "Seleccione presentaciones",
        description: "Debe seleccionar al menos una presentación para facturar",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create billing invoice
      const invoice = await createBillingInvoice({
        obraSocialId: data.obraSocialId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        invoiceNumber: data.invoiceNumber,
        selectedPresentations,
      });

      // Generate Excel file
      await generateExcelFile(invoice.id);

      toast({
        title: "Factura creada exitosamente",
        description: `Se ha creado la factura N° ${data.invoiceNumber} y generado el archivo Excel`,
      });

      // Reset form
      form.reset();
      setSelectedPresentations([]);
      setAvailablePresentations([]);
      setPreviewData(null);
      
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error al crear factura",
        description: "Hubo un problema al procesar la facturación",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Nueva Facturación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Selection Fields */}
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
                            {obra.nombre} ({obra.tipo})
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
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Factura</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: FAC-001-2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Inicio</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : "Seleccionar fecha"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodEnd"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Fin</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : "Seleccionar fecha"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Presentations List */}
            {availablePresentations.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Presentaciones Disponibles ({availablePresentations.length})
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedPresentations.length === availablePresentations.length 
                      ? "Deseleccionar Todo" 
                      : "Seleccionar Todo"
                    }
                  </Button>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {availablePresentations.map((presentation) => (
                    <div
                      key={presentation.id}
                      className="flex items-center space-x-2 p-3 border rounded-lg"
                    >
                      <Checkbox
                        id={presentation.id}
                        checked={selectedPresentations.includes(presentation.id)}
                        onCheckedChange={() => handlePresentationToggle(presentation.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{presentation.patient_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Orden: {presentation.order_description} | 
                          Completada: {format(new Date(presentation.completed_at), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    {selectedPresentations.length} de {availablePresentations.length} seleccionadas
                  </span>
                  
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => generatePreview(form.getValues())}
                      disabled={loading || selectedPresentations.length === 0}
                    >
                      Vista Previa
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isGenerating || selectedPresentations.length === 0}
                      className="min-w-[200px]"
                    >
                      {isGenerating ? "Generando..." : "Crear Factura y Generar Excel"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {availablePresentations.length === 0 && watchedObraId && watchedPeriodStart && watchedPeriodEnd && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No se encontraron presentaciones completadas para el período seleccionado
                </p>
              </div>
            )}

            {previewData && (
              <div className="mt-6 p-4 border rounded-lg bg-muted/30">
                <h3 className="font-semibold mb-3">Vista Previa de la Facturación</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Factura N°:</strong> {previewData.invoiceNumber}</p>
                  <p><strong>Período:</strong> {format(previewData.periodStart, "dd/MM/yyyy")} - {format(previewData.periodEnd, "dd/MM/yyyy")}</p>
                  <p><strong>Presentaciones:</strong> {previewData.presentations.length}</p>
                  <div className="mt-4">
                    <p className="font-medium mb-2">Presentaciones incluidas:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {previewData.presentations.map((p: any) => (
                        <div key={p.id} className="flex justify-between text-xs p-2 bg-background rounded">
                          <span>{p.patient_name}</span>
                          <span>{p.sessions_completed}/{p.total_sessions} sesiones</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}