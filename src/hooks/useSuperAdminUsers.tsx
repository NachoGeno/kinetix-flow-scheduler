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
    password: string;
    role: string;
    organization_id: string;
  }) => {
    try {
      // Create the user in the auth system with email and password
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        user_metadata: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          role: userData.role,
          organization_id: userData.organization_id
        },
        email_confirm: true // Auto-confirm the email
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        toast({
          title: "Error",
          description: `No se pudo crear el usuario: ${authError.message}`,
          variant: "destructive",
        });
        return false;
      }

      // Update the profile with the correct organization and role
      if (authUser.user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            role: userData.role as any,
            organization_id: userData.organization_id
          })
          .eq('user_id', authUser.user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          // Don't fail the whole operation for this
        }
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