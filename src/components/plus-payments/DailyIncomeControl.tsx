import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarIcon, DollarSign, TrendingUp, Calculator } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlusPayments, type DailyStats } from '@/hooks/usePlusPayments';

export function DailyIncomeControl() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const { getDailyStats } = usePlusPayments();

  useEffect(() => {
    fetchDailyStats();
  }, [selectedDate]);

  const fetchDailyStats = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const data = await getDailyStats(dateStr);
      setStats(data);
    } catch (error) {
      console.error('Error fetching daily stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ 
    title, 
    amount, 
    icon: Icon, 
    variant = 'default' 
  }: { 
    title: string; 
    amount: number; 
    icon: any; 
    variant?: 'default' | 'cash' | 'transfer' | 'digital';
  }) => {
    const getCardStyle = () => {
      switch (variant) {
        case 'cash':
          return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
        case 'transfer':
          return 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800';
        case 'digital':
          return 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800';
        default:
          return 'bg-muted/50';
      }
    };

    return (
      <Card className={getCardStyle()}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold">${amount.toFixed(2)}</p>
            </div>
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Control Diario de Ingresos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selector de fecha */}
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Button onClick={fetchDailyStats} disabled={loading}>
              {loading ? 'Cargando...' : 'Actualizar'}
            </Button>
          </div>

          {/* Estadísticas */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total del Día"
                amount={Number(stats.total_amount)}
                icon={DollarSign}
              />
              <StatCard
                title="Efectivo"
                amount={Number(stats.cash_amount)}
                icon={DollarSign}
                variant="cash"
              />
              <StatCard
                title="Transferencias"
                amount={Number(stats.transfer_amount)}
                icon={DollarSign}
                variant="transfer"
              />
              <StatCard
                title="Mercado Pago"
                amount={Number(stats.mercado_pago_amount)}
                icon={DollarSign}
                variant="digital"
              />
            </div>
          )}

          {/* Resumen adicional */}
          {stats && (
            <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Total de Transacciones</p>
                    <p className="text-xl font-bold">{Number(stats.total_payments)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Promedio por Transacción</p>
                    <p className="text-xl font-bold">
                      ${Number(stats.total_payments) > 0 
                        ? (Number(stats.total_amount) / Number(stats.total_payments)).toFixed(2)
                        : '0.00'
                      }
                    </p>
                  </div>
                  <Calculator className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Distribución por método de pago */}
          {stats && Number(stats.total_amount) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribución por Método de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Efectivo', amount: Number(stats.cash_amount), color: 'bg-green-500' },
                    { name: 'Transferencias', amount: Number(stats.transfer_amount), color: 'bg-blue-500' },
                    { name: 'Mercado Pago', amount: Number(stats.mercado_pago_amount), color: 'bg-purple-500' }
                  ].map((method) => {
                    const percentage = (method.amount / Number(stats.total_amount)) * 100;
                    return (
                      <div key={method.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{method.name}</span>
                          <span>${method.amount.toFixed(2)} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`${method.color} h-2 rounded-full transition-all duration-300`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}