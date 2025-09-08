import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  is_active: boolean;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  max_users: number;
  max_patients: number;
  plan_type: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
}

interface OrganizationContextType {
  organization: Organization | null;
  loading: boolean;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

interface OrganizationProviderProps {
  children: ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const { user, profile } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOrganization = async () => {
    if (!profile?.organization_id) {
      setOrganization(null);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      if (error) {
        console.error('Error fetching organization:', error);
        return;
      }

      setOrganization(data);
    } catch (error) {
      console.error('Error in fetchOrganization:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshOrganization = async () => {
    await fetchOrganization();
  };

  useEffect(() => {
    if (user && profile?.organization_id) {
      fetchOrganization();
    } else {
      setOrganization(null);
    }
  }, [user, profile?.organization_id]);

  return (
    <OrganizationContext.Provider value={{ organization, loading, refreshOrganization }}>
      {children}
    </OrganizationContext.Provider>
  );
}