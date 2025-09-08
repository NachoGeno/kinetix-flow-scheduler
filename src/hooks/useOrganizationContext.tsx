import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';

interface OrganizationContextState {
  currentOrgId: string | null;
  currentOrgName: string | null;
  isMultiTenant: boolean;
  isSuperAdmin: boolean;
}

const OrganizationContext = createContext<OrganizationContextState | undefined>(undefined);

export function useOrganizationContext(): OrganizationContextState {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganizationContext must be used within an OrganizationContextProvider');
  }
  return context;
}

interface OrganizationContextProviderProps {
  children: ReactNode;
}

export function OrganizationContextProvider({ children }: OrganizationContextProviderProps) {
  const { profile } = useAuth();
  const { organization } = useOrganization();
  const [contextState, setContextState] = useState<OrganizationContextState>({
    currentOrgId: null,
    currentOrgName: null,
    isMultiTenant: true, // Sistema siempre es multi-tenant ahora
    isSuperAdmin: false
  });

  useEffect(() => {
    setContextState({
      currentOrgId: organization?.id || null,
      currentOrgName: organization?.name || null,
      isMultiTenant: true,
      isSuperAdmin: profile?.role === 'super_admin'
    });
  }, [organization, profile]);

  return (
    <OrganizationContext.Provider value={contextState}>
      {children}
    </OrganizationContext.Provider>
  );
}