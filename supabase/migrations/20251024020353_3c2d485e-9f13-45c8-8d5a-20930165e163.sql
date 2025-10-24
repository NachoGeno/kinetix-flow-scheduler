-- FASE 3: Trigger de sincronización user_roles → profiles.role
-- ==============================================================

-- 1. Crear función para sincronizar roles automáticamente
CREATE OR REPLACE FUNCTION sync_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar el rol en profiles cuando se actualiza en user_roles
  UPDATE profiles 
  SET role = NEW.role,
      updated_at = NOW()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- 2. Crear trigger en user_roles para sincronización automática
DROP TRIGGER IF EXISTS sync_role_to_profile ON user_roles;

CREATE TRIGGER sync_role_to_profile
AFTER INSERT OR UPDATE OF role ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_role();

-- 3. Comentarios de auditoría
COMMENT ON FUNCTION sync_profile_role IS 'Sincroniza automáticamente user_roles.role → profiles.role para compatibilidad';
COMMENT ON TRIGGER sync_role_to_profile ON user_roles IS 'Trigger que mantiene profiles.role sincronizado con user_roles.role';

-- 4. Verificar sincronización inicial (por si hay desincronizaciones)
UPDATE profiles p
SET role = ur.role
FROM user_roles ur
WHERE p.user_id = ur.user_id
AND p.role != ur.role;