import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Trash2, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePlusPayments, type PaymentMethod } from '@/hooks/usePlusPayments';
import { PlusPaymentForm } from './PlusPaymentForm';
import { supabase } from '@/integrations/supabase/client';

interface PlusPaymentListItem {
  id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  observations?: string;
  patient_id: string;
  medical_order_id: string;
  professional_id?: string;
  collected_by: string;
  created_at: string;
  updated_at: string;
}

export function PlusPaymentsList() {
  const [payments, setPayments] = useState<PlusPaymentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const { getPlusPayments, deletePlusPayment } = usePlusPayments();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      // Usar consulta simple sin joins por ahora
      const { data, error } = await supabase
        .from('plus_payments')
        .select('*')
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de que desea eliminar este plus payment?')) {
      try {
        await deletePlusPayment(id);
        fetchPayments();
      } catch (error) {
        console.error('Error deleting payment:', error);
      }
    }
  };

  const filteredPayments = payments.filter(payment => {
    const searchLower = searchTerm.toLowerCase();
    
    return (
      payment.patient_id.toLowerCase().includes(searchLower) ||
      payment.medical_order_id.toLowerCase().includes(searchLower) ||
      payment.amount.toString().includes(searchLower) ||
      (payment.observations && payment.observations.toLowerCase().includes(searchLower))
    );
  });

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    const labels = {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      mercado_pago: 'Mercado Pago'
    };
    return labels[method];
  };

  const getPaymentMethodVariant = (method: PaymentMethod) => {
    const variants = {
      cash: 'default',
      transfer: 'secondary',
      mercado_pago: 'outline'
    };
    return variants[method] as any;
  };

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          Cargando plus payments...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Plus Payments Registrados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Búsqueda y estadísticas */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por paciente, profesional o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total mostrado</p>
              <p className="text-xl font-bold">${totalAmount.toFixed(2)}</p>
            </div>
          </div>

          {/* Lista de payments */}
          <div className="space-y-2">
            {filteredPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron plus payments
              </div>
            ) : (
              filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        Paciente ID: {payment.patient_id.slice(0, 8)}...
                      </span>
                      <Badge variant={getPaymentMethodVariant(payment.payment_method)}>
                        {getPaymentMethodLabel(payment.payment_method)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Orden médica: {payment.medical_order_id.slice(0, 8)}...
                    </p>
                    {payment.professional_id && (
                      <p className="text-xs text-muted-foreground">
                        Profesional ID: {payment.professional_id.slice(0, 8)}...
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.payment_date), 'PPP', { locale: es })}
                    </p>
                    {payment.observations && (
                      <p className="text-xs text-muted-foreground italic">
                        {payment.observations}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">
                      ${Number(payment.amount).toFixed(2)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPayment(payment.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(payment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para editar */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar Plus Payment</DialogTitle>
          </DialogHeader>
          {editingPayment && (
            <PlusPaymentForm
              onSuccess={() => {
                setEditingPayment(null);
                fetchPayments();
              }}
              onCancel={() => setEditingPayment(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}