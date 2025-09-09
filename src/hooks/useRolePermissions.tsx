import { useAuth } from '@/hooks/useAuth';

export type UserRole = 'admin' | 'doctor' | 'patient' | 'reception' | 'super_admin' | 'secretaria';

interface RolePermissions {
  canAccessModule: (module: string) => boolean;
  canAccessAdminOnlyModules: () => boolean;
  canAccessSecretariaModules: () => boolean;
  isAdmin: () => boolean;
  isSecretary: () => boolean;
  isDoctor: () => boolean;
  isPatient: () => boolean;
  isReception: () => boolean;
  isSuperAdmin: () => boolean;
  getCurrentRole: () => UserRole | null;
}

export const useRolePermissions = (): RolePermissions => {
  const { profile } = useAuth();
  const currentRole = profile?.role as UserRole | null;

  const canAccessModule = (module: string): boolean => {
    if (!currentRole) return false;

    // Definir qué roles pueden acceder a cada módulo
    const modulePermissions: Record<string, UserRole[]> = {
      dashboard: ['admin', 'doctor', 'patient', 'secretaria', 'reception', 'super_admin'],
      appointments: ['admin', 'doctor', 'patient', 'secretaria', 'reception', 'super_admin'],
      patients: ['admin', 'doctor', 'patient', 'secretaria', 'reception', 'super_admin'],
      doctors: ['admin', 'patient', 'secretaria', 'reception', 'super_admin'],
      orders: ['admin', 'doctor', 'secretaria', 'reception', 'super_admin'],
      'obras-sociales': ['admin', 'doctor', 'secretaria', 'reception', 'super_admin'],
      presentaciones: ['admin', 'doctor', 'secretaria', 'reception', 'super_admin'],
      billing: ['admin', 'super_admin'], // Solo administradores
      'plus-payments': ['admin', 'reception', 'secretaria', 'super_admin'],
      'cash-management': ['admin', 'reception', 'secretaria', 'super_admin'],
      'medical-records': ['admin', 'doctor', 'patient', 'super_admin'],
      novedades: ['admin', 'doctor', 'reception', 'secretaria', 'super_admin'],
      reports: ['admin', 'super_admin'], // Solo administradores
      configuracion: ['admin', 'super_admin'],
      'saas-admin': ['super_admin']
    };

    const allowedRoles = modulePermissions[module];
    return allowedRoles ? allowedRoles.includes(currentRole) : false;
  };

  const canAccessAdminOnlyModules = (): boolean => {
    return currentRole === 'admin' || currentRole === 'super_admin';
  };

  const canAccessSecretariaModules = (): boolean => {
    return ['admin', 'super_admin', 'secretaria', 'reception'].includes(currentRole || '');
  };

  const isAdmin = (): boolean => {
    return currentRole === 'admin';
  };

  const isSecretary = (): boolean => {
    return currentRole === 'secretaria';
  };

  const isDoctor = (): boolean => {
    return currentRole === 'doctor';
  };

  const isPatient = (): boolean => {
    return currentRole === 'patient';
  };

  const isReception = (): boolean => {
    return currentRole === 'reception';
  };

  const isSuperAdmin = (): boolean => {
    return currentRole === 'super_admin';
  };

  const getCurrentRole = (): UserRole | null => {
    return currentRole;
  };

  return {
    canAccessModule,
    canAccessAdminOnlyModules,
    canAccessSecretariaModules,
    isAdmin,
    isSecretary,
    isDoctor,
    isPatient,
    isReception,
    isSuperAdmin,
    getCurrentRole,
  };
};