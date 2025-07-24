import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlusPayments, type PaymentMethod } from '@/hooks/usePlusPayments';
import { useAuth } from '@/hooks/useAuth';

const plusPaymentSchema = z.object({
  patient_id: z.string().min(1, 'Seleccione un paciente'),
  medical_order_id: z.string().min(1, 'Seleccione una orden médica'),
  professional_id: z.string().optional(),
  amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  payment_method: z.enum(['cash', 'transfer', 'mercado_pago'] as const),
  payment_date: z.date(),
  observations: z.string().optional()
});

type PlusPaymentFormData = z.infer<typeof plusPaymentSchema>;

interface PlusPaymentFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: {
    patient_id?: string;
    medical_order_id?: string;
    professional_id?: string;
  };
}

export function PlusPaymentForm({ onSuccess, onCancel, initialData }: PlusPaymentFormProps) {
  const { user } = useAuth();
  const { createPlusPayment, checkExistingPlusPayment } = usePlusPayments();
  const [loading, setLoading] = useState(false);
  const [existingPayment, setExistingPayment] = useState<any>(null);

  const form = useForm<PlusPaymentFormData>({
    resolver: zodResolver(plusPaymentSchema),
    defaultValues: {
      patient_id: initialData?.patient_id || '',
      medical_order_id: initialData?.medical_order_id || '',
      professional_id: initialData?.professional_id || '',
      amount: 0,
      payment_method: 'cash',
      payment_date: new Date(),
      observations: ''
    }
  });

  // Verificar si ya existe un plus payment para esta orden médica
  useEffect(() => {
    const checkExisting = async () => {
      if (initialData?.medical_order_id) {
        const existing = await checkExistingPlusPayment(initialData.medical_order_id);
        setExistingPayment(existing);
      }
    };
    
    checkExisting();
  }, [initialData?.medical_order_id, checkExistingPlusPayment]);

  const onSubmit = async (data: PlusPaymentFormData) => {
    if (!user) return;

    try {
      setLoading(true);
      
      await createPlusPayment({
        patient_id: data.patient_id,
        medical_order_id: data.medical_order_id,
        professional_id: data.professional_id,
        amount: data.amount,
        payment_method: data.payment_method,
        collected_by: user.id,
        payment_date: format(data.payment_date, 'yyyy-MM-dd'),
        observations: data.observations
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error creating plus payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const paymentMethodLabels: Record<PaymentMethod, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    mercado_pago: 'Mercado Pago'
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Registrar Plus Payment</CardTitle>
        {existingPayment && (
          <div className="p-3 bg-warning/10 border border-warning rounded-md">
            <p className="text-sm text-warning-foreground">
              <strong>Atención:</strong> Ya existe un plus payment registrado para esta orden médica:
              ${existingPayment.amount} - {paymentMethodLabels[existingPayment.payment_method]} 
              ({format(new Date(existingPayment.payment_date), 'dd/MM/yyyy')})
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de Pago *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar método" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                        <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de Cobro *</FormLabel>
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
                            format(field.value, "PPP")
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
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observaciones adicionales (opcional)"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4 justify-end">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? 'Registrando...' : 'Registrar Plus'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}