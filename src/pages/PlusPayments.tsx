import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, DollarSign, BarChart3, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PlusPaymentForm } from '@/components/plus-payments/PlusPaymentForm';
import { PlusPaymentsList } from '@/components/plus-payments/PlusPaymentsList';
import { DailyIncomeControl } from '@/components/plus-payments/DailyIncomeControl';
import { PlusPaymentsReport } from '@/components/plus-payments/PlusPaymentsReport';

export default function PlusPayments() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Plus</h1>
          <p className="text-muted-foreground">
            Controle los pagos adicionales por tratamiento
          </p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Plus Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Registrar Plus Payment</DialogTitle>
            </DialogHeader>
            <PlusPaymentForm
              onSuccess={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="control" className="space-y-4">
        <TabsList>
          <TabsTrigger value="control" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Control Diario
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Plus Payments
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Reportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="control">
          <DailyIncomeControl />
        </TabsContent>

        <TabsContent value="payments">
          <PlusPaymentsList />
        </TabsContent>

        <TabsContent value="reports">
          <PlusPaymentsReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}