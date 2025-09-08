-- Verificar si existe el usuario y asignar rol super_admin

DO $$
DECLARE
    user_exists INTEGER;
    user_profile_id UUID;
BEGIN
    -- Verificar si existe el usuario con ese email
    SELECT COUNT(*), id INTO user_exists, user_profile_id
    FROM public.profiles 
    WHERE email = 'igenovese@grupoorange.com.ar'
    GROUP BY id;
    
    IF user_exists > 0 THEN
        -- Si existe, actualizar a super_admin
        UPDATE public.profiles 
        SET role = 'super_admin'
        WHERE email = 'igenovese@grupoorange.com.ar';
        
        RAISE NOTICE 'Usuario % actualizado a super_admin', 'igenovese@grupoorange.com.ar';
    ELSE
        RAISE NOTICE 'Usuario % no existe. Debe registrarse primero en /auth', 'igenovese@grupoorange.com.ar';
    END IF;
END $$;

-- Mostrar todos los super_admin actuales
SELECT 
    id,
    email,
    role,
    first_name,
    last_name,
    created_at
FROM public.profiles 
WHERE role = 'super_admin'
ORDER BY created_at;