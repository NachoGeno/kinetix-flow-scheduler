import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ObrasSocialesForm } from "./ObrasSocialesForm";

interface ObraSocial {
  id: string;
  nombre: string;
  cuit: string | null;
  tipo: "obra_social" | "art";
  domicilio: string | null;
  telefono: string | null;
  email: string | null;
  responsable_contacto: string | null;
  condicion_iva: string | null;
  is_active: boolean;
  created_at: string;
}

export function ObrasSocialesList() {
  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([]);
  const [filteredData, setFilteredData] = useState<ObraSocial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedObraSocial, setSelectedObraSocial] = useState<ObraSocial | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    obraSocial: ObraSocial | null;
  }>({ isOpen: false, obraSocial: null });

  useEffect(() => {
    fetchObrasSociales();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = obrasSociales.filter(
        (item) =>
          item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.cuit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.responsable_contacto?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData(obrasSociales);
    }
  }, [searchTerm, obrasSociales]);

  const fetchObrasSociales = async () => {
    try {
      const { data, error } = await supabase
        .from("obras_sociales_art")
        .select("*")
        .eq("is_active", true)
        .order("nombre");

      if (error) throw error;
      setObrasSociales(data || []);
    } catch (error: any) {
      toast.error("Error al cargar las Obras Sociales / ART");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (obraSocial: ObraSocial) => {
    setSelectedObraSocial(obraSocial);
    setIsFormOpen(true);
  };

  const handleDelete = async (obraSocial: ObraSocial) => {
    try {
      const { error } = await supabase
        .from("obras_sociales_art")
        .update({ is_active: false })
        .eq("id", obraSocial.id);

      if (error) throw error;
      
      toast.success("Obra Social / ART eliminada correctamente");
      fetchObrasSociales();
    } catch (error: any) {
      toast.error("Error al eliminar la Obra Social / ART");
    }
    setDeleteDialog({ isOpen: false, obraSocial: null });
  };

  const handleFormSuccess = () => {
    fetchObrasSociales();
    setSelectedObraSocial(null);
  };

  const getTipoLabel = (tipo: string) => {
    return tipo === "obra_social" ? "Obra Social" : "ART";
  };

  const getTipoBadgeVariant = (tipo: string) => {
    return tipo === "obra_social" ? "default" : "secondary";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando obras sociales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Obras Sociales / ART</CardTitle>
            </div>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Obra Social / ART
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, CUIT o responsable..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((obraSocial) => (
                  <TableRow key={obraSocial.id}>
                    <TableCell className="font-medium">
                      {obraSocial.nombre}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTipoBadgeVariant(obraSocial.tipo)}>
                        {getTipoLabel(obraSocial.tipo)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {obraSocial.cuit || "-"}
                    </TableCell>
                    <TableCell>
                      {obraSocial.responsable_contacto || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {obraSocial.telefono && (
                          <div className="text-sm">{obraSocial.telefono}</div>
                        )}
                        {obraSocial.email && (
                          <div className="text-sm text-muted-foreground">
                            {obraSocial.email}
                          </div>
                        )}
                        {!obraSocial.telefono && !obraSocial.email && "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(obraSocial)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDeleteDialog({
                              isOpen: true,
                              obraSocial,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="text-muted-foreground">
                        {searchTerm
                          ? "No se encontraron resultados"
                          : "No hay obras sociales registradas"}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ObrasSocialesForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedObraSocial(null);
        }}
        obraSocial={selectedObraSocial}
        onSuccess={handleFormSuccess}
      />

      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) =>
          setDeleteDialog({ isOpen: open, obraSocial: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Obra Social / ART?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar "{deleteDialog.obraSocial?.nombre}"?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteDialog.obraSocial && handleDelete(deleteDialog.obraSocial)
              }
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}