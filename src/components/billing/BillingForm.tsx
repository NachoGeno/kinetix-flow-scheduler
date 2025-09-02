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
  periodStart: z.date({ required_error: "Fecha de inicio requerida" }),
  periodEnd: z.date({ required_error: "Fecha de fin requerida" }),
  invoiceNumber: z.string().min(1, "Número de factura requerido"),
});

type FormData = z.infer<typeof formSchema>;

export function BillingForm() {
  const [selectedPresentations, setSelectedPresentations] = useState<string[]>([]);
  const [availablePresentations, setAvailablePresentations] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { toast } = useToast();
  const { 
    obrasSociales, 
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

  const onSubmit = async (data: FormData) => {
    if (selectedPresentations.length === 0) {
      toast({
        title: "Error",
        description: "Debe seleccionar al menos una presentación",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Create billing invoice record
      const invoice = await createBillingInvoice({
        obraSocialId: data.obraSocialId,
        invoiceNumber: data.invoiceNumber,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        selectedPresentations,
      });

      // Generate Excel file
      const excelFile = await generateExcelFile(invoice.id);
      
      toast({
        title: "Facturación completada",
        description: `Factura ${data.invoiceNumber} generada exitosamente`,
      });

      // Reset form
      form.reset();
      setSelectedPresentations([]);
      setAvailablePresentations([]);
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al generar la facturación",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
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
                  
                  <Button
                    type="submit"
                    disabled={selectedPresentations.length === 0 || isGenerating}
                    className="min-w-[200px]"
                  >
                    {isGenerating ? (
                      "Generando..."
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Generar Facturación
                      </>
                    )}
                  </Button>
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
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}