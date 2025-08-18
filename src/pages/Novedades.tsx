import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter, MessageCircle, Calendar, Clock, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NovedadesForm } from "@/components/novedades/NovedadesForm";
import { NovedadesList } from "@/components/novedades/NovedadesList";
import { useNovedades } from "@/hooks/useNovedades";

export default function Novedades() {
  const [showForm, setShowForm] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterShift, setFilterShift] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAuthor, setFilterAuthor] = useState("");

  const { data: novedades, isLoading, refetch } = useNovedades({
    fecha: filterDate || undefined,
    turno: filterShift && filterShift !== "all" ? filterShift : undefined,
    categoria: filterCategory && filterCategory !== "all" ? filterCategory : undefined,
    autor: filterAuthor || undefined,
  });

  const handleFormSuccess = () => {
    setShowForm(false);
    refetch();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novedades</h1>
            <p className="text-muted-foreground">Comunicación interna del equipo</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nueva Novedad
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha</label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                placeholder="Filtrar por fecha"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Turno</label>
              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los turnos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los turnos</SelectItem>
                  <SelectItem value="mañana">Mañana</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="completo">Completo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Categoría</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  <SelectItem value="tecnica">Técnica</SelectItem>
                  <SelectItem value="administrativa">Administrativa</SelectItem>
                  <SelectItem value="medica">Médica</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilterDate("");
                  setFilterShift("all");
                  setFilterCategory("all");
                  setFilterAuthor("");
                }}
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* News List */}
      <NovedadesList 
        novedades={(novedades || []) as any} 
        isLoading={isLoading}
        onRefresh={refetch}
      />

      {/* Form Modal */}
      <NovedadesForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}