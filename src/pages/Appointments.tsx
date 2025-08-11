import { useState } from 'react';
import { Calendar as CalendarIcon, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppointmentCalendar from '@/components/appointments/AppointmentCalendar';
import AppointmentsList from '@/components/appointments/AppointmentsList';

export default function Appointments() {
  const [view, setView] = useState('calendar');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Button
          variant="default"
          onClick={async () => {
            try {
              const today = new Date().toISOString().slice(0, 10);
              const { error } = await (await import('@/integrations/supabase/client')).supabase.functions.invoke('send-email', {
                body: { type: 'social_appointments', date_from: today, date_to: today }
              });
              if (error) throw error as any;
              const { toast } = await import('sonner');
              toast.success('Turnos sociales enviados por email');
            } catch (e: any) {
              const { toast } = await import('sonner');
              toast.error(e.message || 'No se pudo enviar el email');
            }
          }}
        >Enviar turnos sociales (hoy)</Button>
      </div>
      <Tabs value={view} onValueChange={setView} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Vista Calendario
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Vista Lista
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendar" className="space-y-4">
          <AppointmentCalendar />
        </TabsContent>
        
        <TabsContent value="list" className="space-y-4">
          <AppointmentsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}