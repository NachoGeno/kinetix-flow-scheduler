-- Fix organization data integrity by updating all medical orders 
-- from the default organization to match the new organization

-- Get the current organization ID that is not the default
DO $$ 
DECLARE
    target_org_id UUID;
BEGIN
    -- Find a non-default organization (the new one created)
    SELECT id INTO target_org_id 
    FROM organizations 
    WHERE id != 'a0000000-0000-0000-0000-000000000001' 
    AND is_active = true 
    LIMIT 1;
    
    IF target_org_id IS NOT NULL THEN
        -- Update medical orders to belong to the correct organization
        UPDATE medical_orders 
        SET organization_id = target_org_id 
        WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
        
        -- Update patients to belong to the correct organization  
        UPDATE patients 
        SET organization_id = target_org_id 
        WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
        
        -- Update doctors to belong to the correct organization
        UPDATE doctors 
        SET organization_id = target_org_id 
        WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
        
        -- Update appointments to belong to the correct organization
        UPDATE appointments 
        SET organization_id = target_org_id 
        WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
        
        -- Update specialties to belong to the correct organization
        UPDATE specialties 
        SET organization_id = target_org_id 
        WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
        
        -- Update obras sociales to belong to the correct organization  
        UPDATE obras_sociales_art 
        SET organization_id = target_org_id 
        WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
        
        RAISE NOTICE 'Successfully updated all data to organization: %', target_org_id;
    ELSE
        RAISE NOTICE 'No target organization found - no updates made';
    END IF;
END $$;