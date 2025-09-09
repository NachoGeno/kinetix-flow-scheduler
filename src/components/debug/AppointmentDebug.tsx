import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function AppointmentDebug() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const searchAppointments = async () => {
    setLoading(true);
    try {
      console.log('🔍 Buscando turnos del 9/9/2024...');
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          organization_id,
          patient:patients!inner(
            id,
            organization_id,
            profile:profiles!inner(first_name, last_name, dni)
          ),
          doctor:doctors(
            id,
            organization_id,
            profile:profiles(first_name, last_name)
          )
        `)
        .eq('appointment_date', '2024-09-09')
        .order('appointment_time');

      console.log('📊 Resultados encontrados:', data?.length || 0);
      console.log('❌ Error si existe:', error);
      console.log('👤 Usuario actual:', profile);
      
      if (data) {
        console.log('📋 Turnos del 9/9:', data);
        const hugoAppointments = data.filter(apt => 
          apt.patient?.profile?.first_name?.toLowerCase().includes('hugo') ||
          apt.patient?.profile?.last_name?.toLowerCase().includes('garcia')
        );
        console.log('🎯 Turnos de Hugo/Garcia:', hugoAppointments);
      }

      setAppointments(data || []);
    } catch (error) {
      console.error('💥 Error completo:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchAppointments();
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Debug: Turnos del 9/9/2024</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button onClick={searchAppointments} disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar Turnos'}
          </Button>
          
          <div className="text-sm">
            <p><strong>Usuario actual:</strong> {profile?.first_name} {profile?.last_name} ({profile?.role})</p>
            <p><strong>Organización:</strong> {profile?.organization_id}</p>
            <p><strong>Total turnos encontrados:</strong> {appointments.length}</p>
          </div>

          <div className="grid gap-2 max-h-96 overflow-y-auto">
            {appointments.map((apt) => (
              <div key={apt.id} className="p-2 border rounded text-xs">
                <div className="flex justify-between items-center">
                  <span>
                    <strong>{apt.patient?.profile?.first_name} {apt.patient?.profile?.last_name}</strong>
                    {apt.patient?.profile?.dni && ` (DNI: ${apt.patient.profile.dni})`}
                  </span>
                  <span className="text-muted-foreground">
                    {apt.appointment_time} - {apt.status}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1">
                  Doctor: {apt.doctor?.profile?.first_name} {apt.doctor?.profile?.last_name}
                </div>
                <div className="text-muted-foreground">
                  Org: {apt.organization_id} | Apt ID: {apt.id}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}