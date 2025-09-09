-- Corregir el problema de organización para el usuario actual
-- El problema es que algunos usuarios no están asignados a la organización correcta

-- Primero, verificar el estado actual  
DO $$
DECLARE
    default_org_id UUID := 'a0000000-0000-0000-0000-000000000001';
    target_org_id UUID := 'd2dc5b0e-cc31-4e04-8b40-4d8e83ff6b67';
    admin_profile RECORD;
BEGIN
    -- Obtener información del perfil de admin de San Lorenzo
    SELECT * INTO admin_profile 
    FROM profiles 
    WHERE email = 'test@rehabilitaresanlo.com' 
    AND organization_id = target_org_id;
    
    IF admin_profile.id IS NOT NULL THEN
        RAISE NOTICE 'Usuario admin encontrado: % % (org: %)', admin_profile.first_name, admin_profile.last_name, admin_profile.organization_id;
        
        -- Verificar que este usuario tenga acceso completo a todos los datos de su organización
        -- Si el usuario pertenece a San Lorenzo, no debería ver datos de Rehabilitare1
        
        -- Actualizar cualquier perfil de usuario que esté viendo datos incorrectos
        -- Esto es temporal para debugging
        RAISE NOTICE 'El usuario de San Lorenzo debería ver solo datos de org: %', target_org_id;
        
        -- Verificar que las funciones de seguridad están funcionando
        RAISE NOTICE 'Verificando funciones de seguridad...';
        
    ELSE
        RAISE NOTICE 'No se encontró el usuario admin de San Lorenzo';
    END IF;
    
    -- Verificar contadores de datos por organización
    DECLARE
        sanlo_patients INTEGER;
        sanlo_doctors INTEGER;  
        rehab1_patients INTEGER;
        rehab1_doctors INTEGER;
    BEGIN
        SELECT COUNT(*) INTO sanlo_patients FROM patients WHERE organization_id = target_org_id;
        SELECT COUNT(*) INTO sanlo_doctors FROM doctors WHERE organization_id = target_org_id;
        SELECT COUNT(*) INTO rehab1_patients FROM patients WHERE organization_id = default_org_id;
        SELECT COUNT(*) INTO rehab1_doctors FROM doctors WHERE organization_id = default_org_id;
        
        RAISE NOTICE 'San Lorenzo - Pacientes: %, Doctores: %', sanlo_patients, sanlo_doctors;
        RAISE NOTICE 'Rehabilitare1 - Pacientes: %, Doctores: %', rehab1_patients, rehab1_doctors;
    END;
    
END $$;