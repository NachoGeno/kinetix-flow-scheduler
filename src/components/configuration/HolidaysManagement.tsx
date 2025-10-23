import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useToast } from '@/hooks/use-toast';
import HolidayForm from './HolidayForm';

export default function HolidaysManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const { currentOrgId } = useOrganizationContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays', currentOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .eq('organization_id', currentOrgId)
        .eq('is_active', true)
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este feriado?')) return;
    
    try {
      const { error } = await supabase
        .from('holidays')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({ title: "Feriado eliminado correctamente" });
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el feriado",
        variant: "destructive",
      });
    }
  };

  const handleSuccess = () => {
    setIsDialogOpen(false);
    setSelectedHoliday(null);
    queryClient.invalidateQueries({ queryKey: ['holidays'] });
  };

  const handleNewHoliday = () => {
    setSelectedHoliday(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (holiday: any) => {
    setSelectedHoliday(holiday);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Feriados</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configura los días no laborables para tu organización
          </p>
        </div>
        <Button onClick={handleNewHoliday}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Feriado
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Cargando feriados...</p>
        </div>
      ) : holidays.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No hay feriados configurados</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crea tu primer feriado para bloqueear días en el calendario
          </p>
          <Button onClick={handleNewHoliday} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Crear Primer Feriado
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {holidays.map((holiday) => (
            <Card key={holiday.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">🎊</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-base">{holiday.name}</p>
                      {holiday.is_national && (
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                          Nacional
                        </Badge>
                      )}
                      {holiday.recurring && (
                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                          Anual
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(holiday.date + 'T00:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(holiday)}
                    title="Editar feriado"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(holiday.id)}
                    title="Eliminar feriado"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedHoliday ? 'Editar' : 'Nuevo'} Feriado
            </DialogTitle>
          </DialogHeader>
          <HolidayForm onSuccess={handleSuccess} existingHoliday={selectedHoliday} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
