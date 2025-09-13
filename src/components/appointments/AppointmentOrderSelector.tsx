import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useOrderAssignments } from '@/hooks/useOrderAssignments';

interface MedicalOrder {
  id: string;
  description: string;
  total_sessions: number;
  sessions_used: number;
  completed: boolean;
  order_date: string;
  doctor_name: string | null;
}

interface AppointmentOrderSelectorProps {
  patientId: string;
  selectedOrderId?: string;
  onOrderSelect: (orderId: string | null) => void;
  showTitle?: boolean;
}

export default function AppointmentOrderSelector({
  patientId,
  selectedOrderId,
  onOrderSelect,
  showTitle = true,
}: AppointmentOrderSelectorProps) {
  const [medicalOrders, setMedicalOrders] = useState<MedicalOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const { getPatientMedicalOrders } = useOrderAssignments();

  useEffect(() => {
    if (patientId) {
      fetchMedicalOrders();
    } else {
      setMedicalOrders([]);
    }
  }, [patientId]);

  const fetchMedicalOrders = async () => {
    try {
      setLoading(true);
      const orders = await getPatientMedicalOrders(patientId);
      setMedicalOrders(orders);
    } finally {
      setLoading(false);
    }
  };

  const getOrderStatus = (order: MedicalOrder) => {
    if (order.completed) return 'completed';
    if (order.sessions_used >= order.total_sessions) return 'full';
    if (order.sessions_used > 0) return 'in_progress';
    return 'new';
  };

  const getStatusBadge = (order: MedicalOrder) => {
    const status = getOrderStatus(order);
    
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="text-green-700 bg-green-100">Completada</Badge>;
      case 'full':
        return <Badge variant="secondary" className="text-orange-700 bg-orange-100">Sessions Completas</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="text-blue-700 bg-blue-100">En Progreso</Badge>;
      case 'new':
        return <Badge variant="outline">Nueva</Badge>;
      default:
        return null;
    }
  };

  const hasMultipleActiveOrders = medicalOrders.filter(order => !order.completed).length > 1;

  if (!patientId) return null;

  return (
    <div className="space-y-4">
      {showTitle && (
        <div>
          <Label className="text-base font-medium">Asignar a Orden Médica</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Selecciona a qué orden médica específica debe contabilizarse esta cita
          </p>
        </div>
      )}

      {hasMultipleActiveOrders && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-orange-800">
                  Múltiples órdenes activas
                </p>
                <p className="text-xs text-orange-700">
                  Este paciente tiene varias órdenes médicas activas. Es importante seleccionar
                  la orden correcta para asegurar que las sesiones se contabilicen adecuadamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Select 
          value={selectedOrderId || ''} 
          onValueChange={(value) => onOrderSelect(value || null)}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar orden médica (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Sin asignar (se usará orden más antigua)</SelectItem>
            {medicalOrders.map((order) => (
              <SelectItem key={order.id} value={order.id}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {order.description.substring(0, 50)}
                      {order.description.length > 50 ? '...' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.sessions_used}/{order.total_sessions} sesiones
                      {order.doctor_name && ` • Dr. ${order.doctor_name}`}
                    </p>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {medicalOrders.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Órdenes disponibles:</Label>
            <div className="space-y-2">
              {medicalOrders.map((order) => (
                <Card 
                  key={order.id} 
                  className={`transition-colors ${
                    selectedOrderId === order.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border'
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">
                          {order.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {order.sessions_used}/{order.total_sessions} sesiones
                          </span>
                          {order.doctor_name && (
                            <span className="text-xs text-muted-foreground">
                              • Dr. {order.doctor_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(order)}
                        {selectedOrderId === order.id && (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}