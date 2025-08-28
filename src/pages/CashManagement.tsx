import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, DollarSign, BarChart3, Calculator, List, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CashDashboard } from '@/components/cash/CashDashboard';
import { ExpenseForm } from '@/components/cash/ExpenseForm';
import { CashReconciliationForm } from '@/components/cash/CashReconciliationForm';
import { ShiftReconciliationForm } from '@/components/cash/ShiftReconciliationForm';
import { TransactionsList } from '@/components/cash/TransactionsList';

export default function CashManagement() {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showReconciliationForm, setShowReconciliationForm] = useState(false);
  const [showShiftReconciliationForm, setShowShiftReconciliationForm] = useState(false);

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
                Arqueo Diario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Arqueo de Caja Diario</DialogTitle>
              </DialogHeader>
              <CashReconciliationForm
                onSuccess={() => setShowReconciliationForm(false)}
                onCancel={() => setShowReconciliationForm(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={showShiftReconciliationForm} onOpenChange={setShowShiftReconciliationForm}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Arqueo por Turno
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Arqueo de Caja por Turno</DialogTitle>
              </DialogHeader>
              <ShiftReconciliationForm
                onSuccess={() => setShowShiftReconciliationForm(false)}
                onCancel={() => setShowShiftReconciliationForm(false)}
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
            Arqueos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <CashDashboard />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsList />
        </TabsContent>

        <TabsContent value="reconciliation">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Tipos de Arqueo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                        onClick={() => setShowReconciliationForm(true)}>
                    <CardContent className="p-6 text-center">
                      <Calculator className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                      <h3 className="font-semibold text-lg mb-2">Arqueo Diario Completo</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Arqueo completo del día (8:00 - 20:00)
                      </p>
                      <Button variant="outline" className="w-full">
                        Realizar Arqueo Diario
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                        onClick={() => setShowShiftReconciliationForm(true)}>
                    <CardContent className="p-6 text-center">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-green-600" />
                      <h3 className="font-semibold text-lg mb-2">Arqueo por Turno</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Arqueo parcial por turno (Mañana/Tarde)
                      </p>
                      <Button variant="outline" className="w-full">
                        Realizar Arqueo por Turno
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}