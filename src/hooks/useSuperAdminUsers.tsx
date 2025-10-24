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
      // Obtener el user_id de este profile_id
      const { data: profileData, error: profileQueryError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', userId)
        .single();

      if (profileQueryError || !profileData?.user_id) {
        console.error('Error obteniendo user_id:', profileQueryError);
        toast({
          title: "Error",
          description: "No se pudo obtener información del usuario",
          variant: "destructive",
        });
        return false;
      }

      // Actualizar SOLO en user_roles (el trigger sincroniza profiles automáticamente)
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: newRole as any })
        .eq('user_id', profileData.user_id);

      if (roleError) {
        console.error('Error updating user_roles:', roleError);
        toast({
          title: "Error",
          description: `No se pudo actualizar el rol: ${roleError.message}`,
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
    password: string;
    role: string;
    organization_id: string;
  }) => {
    try {
      // Call the edge function to create the user with admin privileges
      const { data, error } = await supabase.functions.invoke('create-user-admin', {
        body: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          organization_id: userData.organization_id
        }
      });

      if (error) {
        console.error('Error calling create-user-admin function:', error);
        toast({
          title: "Error",
          description: `No se pudo crear el usuario: ${error.message}`,
          variant: "destructive",
        });
        return false;
      }

      if (data?.error) {
        console.error('Error creating user:', data.error);
        toast({
          title: "Error",
          description: `No se pudo crear el usuario: ${data.error}`,
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