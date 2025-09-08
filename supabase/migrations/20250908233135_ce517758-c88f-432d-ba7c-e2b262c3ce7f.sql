-- Crear un usuario super admin de prueba directo en la base
-- NOTA: Este usuario tendrá acceso temporal, cambiar la contraseña después

INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    gen_random_uuid(),
    'superadmin@test.com',
    crypt('123456', gen_salt('bf')),  -- Contraseña: 123456
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
) ON CONFLICT (email) DO NOTHING;

-- Crear el perfil correspondiente
INSERT INTO public.profiles (
    user_id,
    email,
    first_name,
    last_name,
    role,
    organization_id
) 
SELECT 
    u.id,
    'superadmin@test.com',
    'Super',
    'Admin',
    'super_admin',
    'a0000000-0000-0000-0000-000000000001'
FROM auth.users u 
WHERE u.email = 'superadmin@test.com'
ON CONFLICT (user_id) DO NOTHING;