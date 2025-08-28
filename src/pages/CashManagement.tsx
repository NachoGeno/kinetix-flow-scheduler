import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, DollarSign, BarChart3, Calculator, List } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CashDashboard } from '@/components/cash/CashDashboard';
import { ExpenseForm } from '@/components/cash/ExpenseForm';
import { CashReconciliationForm } from '@/components/cash/CashReconciliationForm';
import { TransactionsList } from '@/components/cash/TransactionsList';

export default function CashManagement() {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showReconciliationForm, setShowReconciliationForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Caja</h1>
          <p className="text-muted-foreground">
            Control completo de ingresos, egresos y arqueos diarios
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showExpenseForm} onOpenChange={setShowExpenseForm}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Registrar Gasto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
              </DialogHeader>
              <ExpenseForm
                onSuccess={() => setShowExpenseForm(false)}
                onCancel={() => setShowExpenseForm(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={showReconciliationForm} onOpenChange={setShowReconciliationForm}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Arqueo de Caja
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Realizar Arqueo de Caja</DialogTitle>
              </DialogHeader>
              <CashReconciliationForm
                onSuccess={() => setShowReconciliationForm(false)}
                onCancel={() => setShowReconciliationForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Transacciones
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Arqueo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <CashDashboard />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsList />
        </TabsContent>

        <TabsContent value="reconciliation">
          <Card>
            <CardHeader>
              <CardTitle>Arqueo de Caja</CardTitle>
            </CardHeader>
            <CardContent>
              <CashReconciliationForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}