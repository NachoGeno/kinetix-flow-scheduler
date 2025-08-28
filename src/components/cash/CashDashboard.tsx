import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarIcon, DollarSign, TrendingUp, TrendingDown, BarChart3, RefreshCw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCashTransactions, DailyCashSummary } from '@/hooks/useCashTransactions';

interface StatCardProps {
  title: string;
  amount: number;
  icon: React.ReactNode;
  variant?: 'income' | 'expense' | 'balance' | 'default';
}

function StatCard({ title, amount, icon, variant = 'default' }: StatCardProps) {
  const getCardStyle = () => {
    switch (variant) {
      case 'income':
        return 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20';
      case 'expense':
        return 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20';
      case 'balance':
        return amount >= 0 
          ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20'
          : 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20';
      default:
        return 'border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-950/20';
    }
  };

  const getAmountStyle = () => {
    switch (variant) {
      case 'income':
        return 'text-green-700 dark:text-green-400';
      case 'expense':
        return 'text-red-700 dark:text-red-400';
      case 'balance':
        return amount >= 0 
          ? 'text-blue-700 dark:text-blue-400'
          : 'text-orange-700 dark:text-orange-400';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <Card className={cn('transition-all hover:shadow-md', getCardStyle())}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className={cn('text-2xl font-bold', getAmountStyle())}>
              ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 rounded-full bg-background shadow-sm">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CashDashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [summary, setSummary] = useState<DailyCashSummary>({
    total_income: 0,
    total_expenses: 0,
    net_balance: 0,
    transaction_count: 0,
    is_reconciled: false
  });
  const [loading, setLoading] = useState(false);

  const { getDailyCashSummary } = useCashTransactions();

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const data = await getDailyCashSummary(dateStr);
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Caja</h2>
          <p className="text-muted-foreground">
            Control diario de ingresos y egresos
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) =>
                  date > new Date() || date < new Date("1900-01-01")
                }
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>
          <Button onClick={fetchSummary} disabled={loading} variant="outline" size="icon">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos del día"
          amount={summary.total_income}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          variant="income"
        />
        <StatCard
          title="Egresos del día"
          amount={summary.total_expenses}
          icon={<TrendingDown className="h-5 w-5 text-red-600" />}
          variant="expense"
        />
        <StatCard
          title="Balance neto"
          amount={summary.net_balance}
          icon={<DollarSign className="h-5 w-5" />}
          variant="balance"
        />
        <StatCard
          title="Transacciones"
          amount={summary.transaction_count}
          icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
          variant="default"
        />
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Estado del día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Estado de arqueo:</span>
                <span className={cn(
                  "text-sm font-medium",
                  summary.is_reconciled ? "text-green-600" : "text-orange-600"
                )}>
                  {summary.is_reconciled ? "Conciliado" : "Pendiente"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Última conciliación:</span>
                <span className="text-sm">
                  {summary.last_reconciliation_date ? 
                    format(new Date(summary.last_reconciliation_date), "dd/MM/yyyy", { locale: es }) : 
                    "Sin registro"
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total transacciones:</span>
                <span className="text-sm font-medium">{summary.transaction_count}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.total_income > 0 || summary.total_expenses > 0 ? (
              <div className="space-y-3">
                {summary.total_income > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Ingresos</span>
                      <span className="font-medium">
                        {((summary.total_income / (summary.total_income + summary.total_expenses)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{
                          width: `${(summary.total_income / (summary.total_income + summary.total_expenses)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                )}
                {summary.total_expenses > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Egresos</span>
                      <span className="font-medium">
                        {((summary.total_expenses / (summary.total_income + summary.total_expenses)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{
                          width: `${(summary.total_expenses / (summary.total_income + summary.total_expenses)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin transacciones registradas
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}