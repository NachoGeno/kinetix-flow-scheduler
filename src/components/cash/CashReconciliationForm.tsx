import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CalendarIcon, Calculator, CheckCircle, AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCashTransactions } from '@/hooks/useCashTransactions';
import { Alert, AlertDescription } from '@/components/ui/alert';

const reconciliationSchema = z.object({
  reconciliation_date: z.date({
    required_error: 'La fecha es requerida',
  }),
  opening_balance: z.number().min(0, 'El saldo inicial debe ser mayor o igual a 0'),
  physical_count: z.number().min(0, 'El conteo físico debe ser mayor o igual a 0'),
  observations: z.string().optional(),
});

type ReconciliationFormData = z.infer<typeof reconciliationSchema>;

interface CashReconciliationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CashReconciliationForm({ onSuccess, onCancel }: CashReconciliationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [existingReconciliation, setExistingReconciliation] = useState<any>(null);
  const [calculatedBalance, setCalculatedBalance] = useState(0);
  const [difference, setDifference] = useState(0);

  const { createCashReconciliation, getDailyCashSummary, getCashReconciliation, loading } = useCashTransactions();

  const form = useForm<ReconciliationFormData>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: {
      reconciliation_date: new Date(),
      opening_balance: 0,
      physical_count: 0,
      observations: '',
    },
  });

  const watchedDate = form.watch('reconciliation_date');
  const watchedOpeningBalance = form.watch('opening_balance');
  const watchedPhysicalCount = form.watch('physical_count');

  // Fetch data when date changes
  useEffect(() => {
    const fetchDayData = async () => {
      if (!watchedDate) return;

      const dateStr = format(watchedDate, 'yyyy-MM-dd');
      
      try {
        // Get daily summary
        const summary = await getDailyCashSummary(dateStr);
        setDailySummary(summary);

        // Check if reconciliation already exists
        const existing = await getCashReconciliation(dateStr);
        setExistingReconciliation(existing);

        if (existing) {
          form.setValue('opening_balance', existing.opening_balance);
          form.setValue('physical_count', existing.physical_count || 0);
          form.setValue('observations', existing.observations || '');
        }
      } catch (error) {
        console.error('Error fetching day data:', error);
      }
    };

    fetchDayData();
  }, [watchedDate]);

  // Calculate balance and difference
  useEffect(() => {
    if (dailySummary) {
      const calculated = watchedOpeningBalance + dailySummary.net_balance;
      setCalculatedBalance(calculated);
      setDifference(watchedPhysicalCount - calculated);
    }
  }, [watchedOpeningBalance, watchedPhysicalCount, dailySummary]);

  const onSubmit = async (data: ReconciliationFormData) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createCashReconciliation({
        reconciliation_date: format(data.reconciliation_date, 'yyyy-MM-dd'),
        opening_balance: data.opening_balance,
        physical_count: data.physical_count,
        observations: data.observations,
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error creating reconciliation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReconciled = existingReconciliation?.is_closed;
  const isDifferenceSignificant = Math.abs(difference) > 0.01;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Arqueo de Caja
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isReconciled && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              El arqueo para esta fecha ya fue realizado.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reconciliation_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de Arqueo *</FormLabel>
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

            {dailySummary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Ingresos del día</p>
                  <p className="text-lg font-semibold text-green-600">
                    ${dailySummary.total_income.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Egresos del día</p>
                  <p className="text-lg font-semibold text-red-600">
                    ${dailySummary.total_expenses.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Balance neto</p>
                  <p className={cn(
                    "text-lg font-semibold",
                    dailySummary.net_balance >= 0 ? "text-blue-600" : "text-orange-600"
                  )}>
                    ${dailySummary.net_balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
                    <FormLabel>Saldo Inicial *</FormLabel>
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
                    <FormLabel>Conteo Físico *</FormLabel>
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

            {dailySummary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Calculado</p>
                  <p className="text-lg font-semibold">
                    ${calculatedBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    (Inicial + Balance Neto)
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
                  Hay una diferencia de ${Math.abs(difference).toLocaleString('es-AR', { minimumFractionDigits: 2 })} 
                  {difference > 0 ? ' a favor (sobrante)' : ' en contra (faltante)'}.
                  Verifique el conteo físico y las transacciones del día.
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
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
                {isSubmitting ? 'Procesando...' : isReconciled ? 'Ya Conciliado' : 'Realizar Arqueo'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}