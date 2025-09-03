import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Download, Eye, FileText, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBilling } from "@/hooks/useBilling";
import { useToast } from "@/hooks/use-toast";

export function BillingHistory() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const { getBillingHistory, downloadInvoiceFile } = useBilling();
  const { toast } = useToast();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await getBillingHistory();
      setInvoices(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar el historial de facturación",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (invoiceId: string, fileName: string) => {
    try {
      await downloadInvoiceFile(invoiceId, fileName);
      toast({
        title: "Descarga iniciada",
        description: "El archivo se está descargando",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al descargar el archivo",
        variant: "destructive",
      });
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.obra_social_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando historial...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Historial de Facturación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por número de factura u obra social..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoices Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Obra Social</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Presentaciones</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    No se encontraron facturas
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoice_number}
                    </TableCell>
                    
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.obra_social_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.obra_social_tipo}
                        </p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(new Date(invoice.period_start), "dd/MM/yyyy")}</p>
                        <p className="text-muted-foreground">
                          {format(new Date(invoice.period_end), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </TableCell>
                    
                    <TableCell>{invoice.total_presentations}</TableCell>
                    
                    <TableCell>
                      {invoice.total_amount ? 
                        `$${Number(invoice.total_amount).toLocaleString()}` : 
                        "-"
                      }
                    </TableCell>
                    
                    <TableCell>
                      {format(new Date(invoice.sent_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={invoice.status === 'sent' ? 'default' : 'secondary'}>
                        {invoice.status === 'sent' ? 'Enviado' : 'Pendiente'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {/* TODO: View details */}}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(invoice.id, invoice.file_name)}
                          disabled={!invoice.file_name}
                          title={invoice.file_name ? "Descargar Excel" : "Excel no disponible"}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}