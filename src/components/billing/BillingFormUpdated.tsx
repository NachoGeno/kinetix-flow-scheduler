import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2, Loader2, AlertCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

interface DocumentValidation {
  orderId: string;
  patientName: string;
  isComplete: boolean;
  missingDocuments: string[];
  documentsStatus: {
    medical_order: boolean;
    clinical_evolution: boolean;
    attendance_record: boolean;
    social_work_authorization: boolean;
  };
}

export function BillingFormUpdated() {
  const [selectedPresentations, setSelectedPresentations] = useState<string[]>([]);
  const [availablePresentations, setAvailablePresentations] = useState<any[]>([]);
  const [documentValidations, setDocumentValidations] = useState<Record<string, DocumentValidation>>({});
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [validatingDocs, setValidatingDocs] = useState(false);
  
  const { toast } = useToast();
  const { 
    obrasSociales, 
    loading,
    isGenerating,
    getCompletedPresentations, 
    createBillingInvoice,
    validatePresentationDocuments,
    generateBillingPackage,
    cancelBillingInvoice
  } = useBilling();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodStart: new Date(new Date().setDate(1)),
      periodEnd: new Date(),
    },
  });

  const watchedObraId = form.watch("obraSocialId");
  const watchedPeriodStart = form.watch("periodStart");
  const watchedPeriodEnd = form.watch("periodEnd");

  useEffect(() => {
    if (watchedObraId && watchedPeriodStart && watchedPeriodEnd) {
      loadPresentations();
    }
  }, [watchedObraId, watchedPeriodStart, watchedPeriodEnd]);

  useEffect(() => {
    if (selectedPresentations.length > 0) {
      validateDocuments();
    } else {
      setDocumentValidations({});
    }
  }, [selectedPresentations]);

  const loadPresentations = async () => {
    try {
      const presentations = await getCompletedPresentations({
        obraSocialId: watchedObraId,
        periodStart: watchedPeriodStart,
        periodEnd: watchedPeriodEnd,
      });
      setAvailablePresentations(presentations);
      setSelectedPresentations([]);
      setDocumentValidations({});
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar las presentaciones",
        variant: "destructive",
      });
    }
  };

  const validateDocuments = async () => {
    try {
      setValidatingDocs(true);
      const results = await validatePresentationDocuments(selectedPresentations);
      const validationsMap: Record<string, DocumentValidation> = {};
      results.forEach((result: DocumentValidation) => {
        validationsMap[result.orderId] = result;
      });
      setDocumentValidations(validationsMap);
    } catch (error) {
      console.error('Error validating documents:', error);
    } finally {
      setValidatingDocs(false);
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

  const getDocumentStatusBadge = (orderId: string) => {
    const validation = documentValidations[orderId];
    if (!validation) return null;

    if (validation.isComplete) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          4/4 completos
        </Badge>
      );
    }

    const completedCount = Object.values(validation.documentsStatus).filter(Boolean).length;
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        {completedCount}/4 (Falta: {validation.missingDocuments.join(', ')})
      </Badge>
    );
  };

  const hasIncompleteDocuments = () => {
    return Object.values(documentValidations).some(v => !v.isComplete);
  };

  const onCreateInvoice = async (data: FormData) => {
    if (selectedPresentations.length === 0) {
      toast({
        title: "Seleccione presentaciones",
        description: "Debe seleccionar al menos una presentación",
        variant: "destructive",
      });
      return;
    }

    if (hasIncompleteDocuments()) {
      toast({
        title: "Documentación incompleta",
        description: "No se puede facturar con documentación incompleta. Todos los documentos son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    try {
      const invoice = await createBillingInvoice({
        obraSocialId: data.obraSocialId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        invoiceNumber: data.invoiceNumber,
        selectedPresentations,
      });

      setCreatedInvoiceId(invoice.id);
      
      toast({
        title: "Factura creada",
        description: "Factura creada exitosamente. Ahora puede generar el paquete completo.",
      });

    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error al crear factura",
        description: "Hubo un problema al crear la factura",
        variant: "destructive",
      });
    }
  };

  const onGeneratePackage = async () => {
    if (!createdInvoiceId) return;

    try {
      await generateBillingPackage(createdInvoiceId, false);

      toast({
        title: "Paquete generado exitosamente",
        description: "El paquete ZIP con Excel y PDFs consolidados está listo para descargar",
      });

      // Reset form
      form.reset();
      setSelectedPresentations([]);
      setAvailablePresentations([]);
      setDocumentValidations({});
      setCreatedInvoiceId(null);
      
    } catch (error) {
      console.error('Error generating package:', error);
      toast({
        title: "Error al generar paquete",
        description: "Hubo un problema. Puede cancelar esta factura y reintentar.",
        variant: "destructive",
        action: (
          <Button 
            variant="outline" 
            size="sm"
            onClick={async () => {
              try {
                await cancelBillingInvoice(createdInvoiceId);
                setCreatedInvoiceId(null);
                form.reset();
                setSelectedPresentations([]);
                setAvailablePresentations([]);
                setDocumentValidations({});
                toast({ 
                  title: "Factura cancelada",
                  description: "Las presentaciones están disponibles nuevamente"
                });
              } catch (err) {
                toast({
                  title: "Error",
                  description: "No se pudo cancelar la factura",
                  variant: "destructive"
                });
              }
            }}
          >
            Cancelar Factura
          </Button>
        )
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva Facturación con Paquete Completo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!createdInvoiceId ? (
          // STEP 1: Create Invoice
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateInvoice)} className="space-y-6">
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

                  {validatingDocs && (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertDescription>
                        Validando documentación de presentaciones seleccionadas...
                      </AlertDescription>
                    </Alert>
                  )}

                  {hasIncompleteDocuments() && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        ⚠️ Hay presentaciones con documentación incompleta. Todos los documentos son obligatorios para poder facturar.
                      </AlertDescription>
                    </Alert>
                  )}

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
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{presentation.patient_name}</p>
                            {selectedPresentations.includes(presentation.id) && getDocumentStatusBadge(presentation.id)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Orden: {presentation.order_description} | 
                            Completada: {format(new Date(presentation.completed_at), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      type="submit" 
                      disabled={loading || selectedPresentations.length === 0 || hasIncompleteDocuments()}
                      className="min-w-[200px]"
                    >
                      Crear Factura (Paso 1)
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Form>
        ) : (
          // STEP 2: Generate Package
          <div className="space-y-6">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                ✅ Factura creada exitosamente. Ahora genere el paquete completo con Excel y PDFs consolidados.
              </AlertDescription>
            </Alert>

            {isGenerating ? (
              <div className="space-y-4">
                <h3 className="font-semibold">Generando paquete completo...</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Validando documentos...</span>
                  </div>
                  <div className="flex items-center gap-2 pl-6 text-muted-foreground">
                    <span>Generando Excel...</span>
                  </div>
                  <div className="flex items-center gap-2 pl-6 text-muted-foreground">
                    <span>Consolidando PDFs...</span>
                  </div>
                  <div className="flex items-center gap-2 pl-6 text-muted-foreground">
                    <span>Creando archivo ZIP...</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-4">
                <Button 
                  onClick={onGeneratePackage}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  Generar Paquete Completo (Paso 2)
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setCreatedInvoiceId(null);
                    form.reset();
                    setSelectedPresentations([]);
                    setAvailablePresentations([]);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
