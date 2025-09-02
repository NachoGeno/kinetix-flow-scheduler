import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingForm } from "@/components/billing/BillingForm";
import { BillingHistory } from "@/components/billing/BillingHistory";
import { ExportTemplateManager } from "@/components/billing/ExportTemplateManager";

export default function Billing() {
  const [activeTab, setActiveTab] = useState("new");

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Facturación por Obra Social</h1>
        <p className="text-muted-foreground">
          Genere facturas para obras sociales y ART basadas en presentaciones completadas
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="new">Nueva Facturación</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6">
          <BillingForm />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <BillingHistory />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <ExportTemplateManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}