import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CalendarIcon, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCashTransactions, ShiftType } from '@/hooks/useCashTransactions';
import { Alert, AlertDescription } from '@/components/ui/alert';

const shiftReconciliationSchema = z.object({
  reconciliation_date: z.date({
    required_error: 'La fecha es requerida',
  }),
  shift_type: z.enum(['morning', 'afternoon', 'full_day']),
  opening_balance: z.number().min(0, 'El saldo inicial debe ser mayor o igual a 0'),
  physical_count: z.number().min(0, 'El conteo físico debe ser mayor o igual a 0'),
  observations: z.string().optional(),
});

type ShiftReconciliationFormData = z.infer<typeof shiftReconciliationSchema>;

interface ShiftReconciliationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const shiftOptions = [
  { value: 'morning', label: 'Turno Mañana (8:00 - 14:00)' },
  { value: 'afternoon', label: 'Turno Tarde (14:00 - 20:00)' },
  { value: 'full_day', label: 'Día Completo (8:00 - 20:00)' },
];

export function ShiftReconciliationForm({ onSuccess, onCancel }: ShiftReconciliationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [existingReconciliation, setExistingReconciliation] = useState<any>(null);
  const [calculatedBalance, setCalculatedBalance] = useState(0);
  const [difference, setDifference] = useState(0);
  const [previousBalance, setPreviousBalance] = useState(0);

  const { 
    createShiftReconciliation, 
    getShiftCashSummary, 
    getShiftReconciliation, 
    getPreviousShiftBalance,
    loading 
  } = useCashTransactions();

  const form = useForm<ShiftReconciliationFormData>({
    resolver: zodResolver(shiftReconciliationSchema),
    defaultValues: {
      reconciliation_date: new Date(),
      shift_type: 'morning',
      opening_balance: 0,
      physical_count: 0,
      observations: '',
    },
  });

  const watchedDate = form.watch('reconciliation_date');
  const watchedShift = form.watch('shift_type');
  const watchedOpeningBalance = form.watch('opening_balance');
  const watchedPhysicalCount = form.watch('physical_count');

  // Fetch data when date or shift changes
  useEffect(() => {
    const fetchShiftData = async () => {
      if (!watchedDate || !watchedShift) return;

      const dateStr = format(watchedDate, 'yyyy-MM-dd');
      
      try {
        // Get shift summary
        const summary = await getShiftCashSummary(dateStr, watchedShift);
        setShiftSummary(summary);

        // Check if reconciliation already exists
        const existing = await getShiftReconciliation(dateStr, watchedShift);
        setExistingReconciliation(existing);

        // Get previous shift balance
        const prevBalance = await getPreviousShiftBalance(dateStr, watchedShift);
        setPreviousBalance(prevBalance);
        
        // Auto-fill opening balance if not manually set
        if (!form.formState.dirtyFields.opening_balance) {
          form.setValue('opening_balance', prevBalance);
        }

        if (existing) {
          form.setValue('opening_balance', existing.opening_balance);
          form.setValue('physical_count', existing.physical_count || 0);
          form.setValue('observations', existing.observations || '');
        }
      } catch (error) {
        console.error('Error fetching shift data:', error);
      }
    };

    fetchShiftData();
  }, [watchedDate, watchedShift]);

  // Calculate balance and difference
  useEffect(() => {
    if (shiftSummary) {
      const calculated = watchedOpeningBalance + shiftSummary.net_balance;
      setCalculatedBalance(calculated);
      setDifference(watchedPhysicalCount - calculated);
    }
  }, [watchedOpeningBalance, watchedPhysicalCount, shiftSummary]);

  const onSubmit = async (data: ShiftReconciliationFormData) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createShiftReconciliation({
        reconciliation_date: format(data.reconciliation_date, 'yyyy-MM-dd'),
        shift_type: data.shift_type,
        opening_balance: data.opening_balance,
        physical_count: data.physical_count,
        observations: data.observations,
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error creating shift reconciliation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReconciled = existingReconciliation?.is_closed;
  const isDifferenceSignificant = Math.abs(difference) > 0.01;
  const selectedShiftLabel = shiftOptions.find(opt => opt.value === watchedShift)?.label;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Arqueo por Turnos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isReconciled && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              El arqueo para este turno ya fue realizado.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reconciliation_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha *</FormLabel>
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
                            {field.value ? (
                              format(field.value, "PPP", { locale: es })
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shift_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Turno *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar turno" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {shiftOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedShiftLabel && (
              <Alert className="bg-blue-50 border-blue-200">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Realizando arqueo para: {selectedShiftLabel}
                  {previousBalance > 0 && (
                    <span className="block mt-1">
                      Balance del turno anterior: ${previousBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {shiftSummary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Ingresos del turno</p>
                  <p className="text-lg font-semibold text-green-600">
                    ${shiftSummary.total_income.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Egresos del turno</p>
                  <p className="text-lg font-semibold text-red-600">
                    ${shiftSummary.total_expenses.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Balance neto</p>
                  <p className={cn(
                    "text-lg font-semibold",
                    shiftSummary.net_balance >= 0 ? "text-blue-600" : "text-orange-600"
                  )}>
                    ${shiftSummary.net_balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="opening_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Saldo Inicial del Turno *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        disabled={isReconciled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="physical_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conteo Físico del Turno *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        disabled={isReconciled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {shiftSummary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Calculado</p>
                  <p className="text-lg font-semibold">
                    ${calculatedBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    (Inicial + Balance del Turno)
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conteo Físico</p>
                  <p className="text-lg font-semibold">
                    ${watchedPhysicalCount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Diferencia</p>
                  <p className={cn(
                    "text-lg font-semibold",
                    difference === 0 ? "text-green-600" : 
                    difference > 0 ? "text-blue-600" : "text-red-600"
                  )}>
                    ${difference.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}

            {isDifferenceSignificant && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Diferencia de ${Math.abs(difference).toLocaleString('es-AR', { minimumFractionDigits: 2 })} 
                  {difference > 0 ? ' a favor (sobrante)' : ' en contra (faltante)'}.
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones del Turno</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Observaciones del arqueo (opcional)"
                      className="resize-none"
                      rows={3}
                      {...field}
                      disabled={isReconciled}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting || loading || isReconciled}
                className="flex items-center gap-2"
              >
                {isSubmitting ? 'Procesando...' : isReconciled ? 'Ya Conciliado' : 'Realizar Arqueo de Turno'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}