import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRolePermissions } from '@/hooks/useRolePermissions';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredModule?: string;
  adminOnly?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requiredModule, 
  adminOnly = false 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { canAccessModule, canAccessAdminOnlyModules } = useRolePermissions();
  const location = useLocation();

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check admin-only access
  if (adminOnly && !canAccessAdminOnlyModules()) {
    return <Navigate to="/" replace />;
  }

  // Check module-specific access
  if (requiredModule && !canAccessModule(requiredModule)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}