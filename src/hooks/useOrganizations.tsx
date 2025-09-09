import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Organization {
  id: string;
  name: string;
  is_active: boolean;
}

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching organizations:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las organizaciones",
          variant: "destructive",
        });
        return;
      }

      setOrganizations(data || []);
    } catch (error) {
      console.error('Error in fetchOrganizations:', error);
      toast({
        title: "Error",
        description: "Error inesperado al cargar organizaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  return {
    organizations,
    loading,
    fetchOrganizations,
  };
}