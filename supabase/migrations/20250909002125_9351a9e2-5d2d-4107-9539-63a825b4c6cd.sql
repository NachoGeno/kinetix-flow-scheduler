-- Create function to get organization statistics for super admins
CREATE OR REPLACE FUNCTION public.get_organization_statistics()
RETURNS TABLE(
    organization_id uuid,
    total_users bigint,
    total_patients bigint,
    total_appointments bigint,
    active_doctors bigint
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        o.id as organization_id,
        COALESCE(user_counts.total_users, 0) as total_users,
        COALESCE(patient_counts.total_patients, 0) as total_patients,
        COALESCE(appointment_counts.total_appointments, 0) as total_appointments,
        COALESCE(doctor_counts.active_doctors, 0) as active_doctors
    FROM organizations o
    LEFT JOIN (
        SELECT organization_id, COUNT(*) as total_users
        FROM profiles 
        WHERE user_id IS NOT NULL
        GROUP BY organization_id
    ) user_counts ON o.id = user_counts.organization_id
    LEFT JOIN (
        SELECT organization_id, COUNT(*) as total_patients
        FROM patients 
        WHERE is_active = true
        GROUP BY organization_id
    ) patient_counts ON o.id = patient_counts.organization_id
    LEFT JOIN (
        SELECT organization_id, COUNT(*) as total_appointments
        FROM appointments
        GROUP BY organization_id
    ) appointment_counts ON o.id = appointment_counts.organization_id
    LEFT JOIN (
        SELECT organization_id, COUNT(*) as active_doctors
        FROM doctors 
        WHERE is_active = true
        GROUP BY organization_id
    ) doctor_counts ON o.id = doctor_counts.organization_id
    ORDER BY o.created_at;
$$;

-- Grant permission only to super admins
REVOKE ALL ON FUNCTION public.get_organization_statistics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_statistics() TO authenticated;