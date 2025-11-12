import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, FileText, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlusPayments, type PaymentMethod, type PlusPaymentReport } from '@/hooks/usePlusPayments';
import { supabase } from '@/integrations/supabase/client';

const reportFiltersSchema = z.object({
  start_date: z.date().optional(),
  end_date: z.date().optional(),
  professional_id: z.string().optional(),
  payment_method: z.string().optional()
});

type ReportFiltersData = z.infer<typeof reportFiltersSchema>;

interface Doctor {
  id: string;
  profile: {
    first_name: string;
    last_name: string;
  };
}

export function PlusPaymentsReport() {
  const { getPlusPaymentsReport } = usePlusPayments();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<PlusPaymentReport[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [totals, setTotals] = useState({
    total_amount: 0,
    cash_amount: 0,
    transfer_amount: 0,
    mercado_pago_amount: 0,
    total_payments: 0
  });

  const form = useForm<ReportFiltersData>({
    resolver: zodResolver(reportFiltersSchema),
    defaultValues: {
      start_date: undefined,
      end_date: undefined,
      professional_id: undefined,
      payment_method: undefined
    }
  });

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id,
          profile:profiles(first_name, last_name)
        `)
        .eq('is_active', true)
        .order('first_name', { foreignTable: 'profiles', ascending: true });

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const calculateTotals = (data: PlusPaymentReport[]) => {
    const totals = data.reduce((acc, payment) => {
      acc.total_amount += Number(payment.amount);
      acc.total_payments += 1;
      
      switch (payment.payment_method) {
        case 'cash':
          acc.cash_amount += Number(payment.amount);
          break;
        case 'transfer':
          acc.transfer_amount += Number(payment.amount);
          break;
        case 'mercado_pago':
          acc.mercado_pago_amount += Number(payment.amount);
          break;
      }
      
      return acc;
    }, {
      total_amount: 0,
      cash_amount: 0,
      transfer_amount: 0,
      mercado_pago_amount: 0,
      total_payments: 0
    });

    setTotals(totals);
  };

  const onSubmit = async (data: ReportFiltersData) => {
    setLoading(true);
    try {
      const filters = {
        start_date: data.start_date ? format(data.start_date, 'yyyy-MM-dd') : undefined,
        end_date: data.end_date ? format(data.end_date, 'yyyy-MM-dd') : undefined,
        professional_filter: (data.professional_id && data.professional_id !== 'all') ? data.professional_id : undefined,
        payment_method_filter: (data.payment_method && data.payment_method !== 'all' && ['cash', 'transfer', 'mercado_pago'].includes(data.payment_method)) 
          ? data.payment_method as PaymentMethod 
          : undefined
      };

      const report = await getPlusPaymentsReport(filters);
      setReportData(report);
      calculateTotals(report);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia';
      case 'mercado_pago': return 'Mercado Pago';
      default: return method;
    }
  };

  const getPaymentMethodVariant = (method: PaymentMethod) => {
    switch (method) {
      case 'cash': return 'default' as const;
      case 'transfer': return 'secondary' as const;
      case 'mercado_pago': return 'outline' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Filtros de Reporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha Desde</FormLabel>
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
                                format(field.value, "dd/MM/yyyy")
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
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha Hasta</FormLabel>
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
                                format(field.value, "dd/MM/yyyy")
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
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="professional_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profesional</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos los profesionales" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">Todos los profesionales</SelectItem>
                          {doctors.map((doctor) => (
                            <SelectItem key={doctor.id} value={doctor.id}>
                              {doctor.profile.first_name} {doctor.profile.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pago</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos los métodos" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">Todos los métodos</SelectItem>
                          <SelectItem value="cash">Efectivo</SelectItem>
                          <SelectItem value="transfer">Transferencia</SelectItem>
                          <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading} className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {loading ? 'Generando...' : 'Generar Reporte'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Pagos</p>
                    <p className="text-2xl font-bold">{totals.total_payments}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Monto</p>
                    <p className="text-2xl font-bold">${totals.total_amount.toFixed(2)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Efectivo</p>
                    <p className="text-2xl font-bold">${totals.cash_amount.toFixed(2)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Digital</p>
                    <p className="text-2xl font-bold">${(totals.transfer_amount + totals.mercado_pago_amount).toFixed(2)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Resultados del Reporte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Profesional</TableHead>
                      <TableHead>Obra Social</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Observaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((payment) => (
                      <TableRow key={payment.payment_id}>
                        <TableCell className="font-medium">{payment.patient_name}</TableCell>
                        <TableCell>{payment.professional_name}</TableCell>
                        <TableCell>{payment.obra_social_name || 'N/A'}</TableCell>
                        <TableCell className="font-mono">${Number(payment.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={getPaymentMethodVariant(payment.payment_method)}>
                            {getPaymentMethodLabel(payment.payment_method)}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(payment.payment_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="max-w-xs truncate">{payment.observations || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {reportData.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay datos para mostrar</h3>
            <p className="text-muted-foreground">
              Ajuste los filtros y genere un reporte para ver los datos de Plus Payments.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}