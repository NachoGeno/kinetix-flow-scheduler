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
import { supabase } from '@/integrations/supabase/client';

const plusPaymentSchema = z.object({
  patient_id: z.string().min(1, 'Seleccione un paciente'),
  medical_order_id: z.string().min(1, 'Seleccione una orden médica'),
  professional_id: z.string().optional().nullable(),
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
  const [patients, setPatients] = useState<any[]>([]);
  const [medicalOrders, setMedicalOrders] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const form = useForm<PlusPaymentFormData>({
    resolver: zodResolver(plusPaymentSchema),
    defaultValues: {
      patient_id: initialData?.patient_id || '',
      medical_order_id: initialData?.medical_order_id || '',
      professional_id: initialData?.professional_id || null,
      amount: 0,
      payment_method: 'cash',
      payment_date: new Date(),
      observations: ''
    }
  });

  // Cargar pacientes al montar el componente
  useEffect(() => {
    const fetchPatients = async () => {
      setLoadingPatients(true);
      try {
        console.log('Fetching patients...');
        
        // Simplificar la consulta para evitar errores
        const { data, error } = await supabase
          .from('patients')
          .select(`
            id,
            profile_id,
            profiles!inner(
              id,
              first_name,
              last_name
            )
          `)
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching patients:', error);
          throw error;
        }

        console.log('Patients data:', data);
        setPatients(data || []);
      } catch (error) {
        console.error('Error fetching patients:', error);
        setPatients([]);
      } finally {
        setLoadingPatients(false);
      }
    };

    fetchPatients();
  }, []);

  // Cargar órdenes médicas cuando se selecciona un paciente
  useEffect(() => {
    const patientId = form.watch('patient_id');
    if (patientId) {
      const fetchMedicalOrders = async () => {
        setLoadingOrders(true);
        try {
          console.log('Fetching medical orders for patient:', patientId);
          
          const { data, error } = await supabase
            .from('medical_orders')
            .select(`
              id,
              description,
              created_at,
              completed
            `)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Error fetching medical orders:', error);
            throw error;
          }

          console.log('Medical orders data:', data);
          setMedicalOrders(data || []);
        } catch (error) {
          console.error('Error fetching medical orders:', error);
          setMedicalOrders([]);
        } finally {
          setLoadingOrders(false);
        }
      };

      fetchMedicalOrders();
    } else {
      setMedicalOrders([]);
    }
  }, [form.watch('patient_id')]);

  // Verificar si ya existe un plus payment para esta orden médica
  useEffect(() => {
    const medicalOrderId = form.watch('medical_order_id');
    const checkExisting = async () => {
      if (medicalOrderId) {
        const existing = await checkExistingPlusPayment(medicalOrderId);
        setExistingPayment(existing);
      } else {
        setExistingPayment(null);
      }
    };
    
    checkExisting();
  }, [form.watch('medical_order_id'), checkExistingPlusPayment]);

  const onSubmit = async (data: PlusPaymentFormData) => {
    if (!user) return;

    try {
      setLoading(true);
      
      console.log('Submitting plus payment with data:', data);
      
      await createPlusPayment({
        patient_id: data.patient_id,
        medical_order_id: data.medical_order_id,
        professional_id: data.professional_id || undefined,
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
                name="patient_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paciente *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingPatients ? "Cargando..." : "Seleccionar paciente"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.profiles.last_name}, {patient.profiles.first_name}
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
                name="medical_order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orden Médica *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value} 
                      disabled={!form.watch('patient_id') || loadingOrders}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !form.watch('patient_id') 
                              ? "Primero seleccione un paciente" 
                              : loadingOrders 
                                ? "Cargando..." 
                                : "Seleccionar orden"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {medicalOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.description} ({format(new Date(order.created_at), 'dd/MM/yyyy')})
                            {order.completed && " ✓"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
