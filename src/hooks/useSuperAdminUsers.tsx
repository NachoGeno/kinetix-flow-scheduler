import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  profile_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  phone?: string;
  created_at: string;
  avatar_url?: string;
  organization_id: string;
  organization_name?: string;
}

export function useSuperAdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Use any type temporarily until Supabase generates new types
      const { data, error } = await supabase.rpc('get_all_users_for_super_admin') as any;
      
      if (error) {
        console.error('Error fetching users:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los usuarios",
          variant: "destructive",
        });
        return;
      }

      setUsers(data || []);
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      toast({
        title: "Error",
        description: "Error inesperado al cargar usuarios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole as any })
        .eq('id', userId);

      if (error) {
        console.error('Error updating user role:', error);
        toast({
          title: "Error",
          description: `No se pudo actualizar el rol del usuario: ${error.message}`,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Éxito",
        description: "Rol actualizado correctamente",
      });
      
      // Refrescar la lista de usuarios
      await fetchUsers();
      return true;
    } catch (error: any) {
      console.error('Error in updateUserRole:', error);
      toast({
        title: "Error",
        description: `Error inesperado: ${error.message}`,
        variant: "destructive",
      });
      return false;
    }
  };

  const createUser = async (userData: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    organization_id: string;
  }) => {
    try {
      // First create the profile without user_id (will be a patient-style profile)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          role: userData.role as any,
          organization_id: userData.organization_id,
          user_id: null // This will be a profile without auth user
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating profile:', profileError);
        toast({
          title: "Error",
          description: `No se pudo crear el usuario: ${profileError.message}`,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Éxito",
        description: "Usuario creado correctamente",
      });
      
      // Refrescar la lista de usuarios
      await fetchUsers();
      return true;
    } catch (error: any) {
      console.error('Error in createUser:', error);
      toast({
        title: "Error",
        description: `Error inesperado: ${error.message}`,
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    fetchUsers,
    updateUserRole,
    createUser,
  };
}