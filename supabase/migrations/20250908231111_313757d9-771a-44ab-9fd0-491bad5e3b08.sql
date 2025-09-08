-- FASE 2: Actualizar políticas RLS para seguridad multi-tenant
-- (Aislamiento total entre organizaciones)

-- 1. Actualizar políticas RLS en PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (
    auth.uid() = user_id 
    OR (
        role = 'patient' 
        AND (
            is_admin(auth.uid()) 
            OR get_user_role(auth.uid()) = 'doctor'
        )
        AND organization_id = get_current_user_organization_id()
    )
);

-- 2. Actualizar políticas RLS en PATIENTS
DROP POLICY IF EXISTS "Doctors can view their patients" ON public.patients;
DROP POLICY IF EXISTS "Patients can view their own data" ON public.patients;
DROP POLICY IF EXISTS "Patients can update their own data" ON public.patients;
DROP POLICY IF EXISTS "Admins can manage all patients" ON public.patients;

CREATE POLICY "Admins can manage patients in their organization" 
ON public.patients 
FOR ALL 
USING (
    is_admin(auth.uid()) 
    AND organization_id = get_current_user_organization_id()
);

CREATE POLICY "Doctors can view patients in their organization" 
ON public.patients 
FOR SELECT 
USING (
    get_user_role(auth.uid()) = 'doctor' 
    AND organization_id = get_current_user_organization_id()
);

CREATE POLICY "Patients can view their own data" 
ON public.patients 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = patients.profile_id 
        AND profiles.user_id = auth.uid()
    )
    AND organization_id = get_current_user_organization_id()
);

CREATE POLICY "Patients can update their own data" 
ON public.patients 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = patients.profile_id 
        AND profiles.user_id = auth.uid()
    )
    AND organization_id = get_current_user_organization_id()
);

-- 3. Actualizar políticas RLS en DOCTORS
DROP POLICY IF EXISTS "Admins can manage all doctors" ON public.doctors;
DROP POLICY IF EXISTS "Authenticated users can view active doctors" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can view their own data" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update their own data" ON public.doctors;
DROP POLICY IF EXISTS "Reception can view all doctors" ON public.doctors;

CREATE POLICY "Admins can manage doctors in their organization" 
ON public.doctors 
FOR ALL 
USING (
    is_admin(auth.uid()) 
    AND organization_id = get_current_user_organization_id()
);

CREATE POLICY "Users can view active doctors in their organization" 
ON public.doctors 
FOR SELECT 
USING (
    is_active = true 
    AND organization_id = get_current_user_organization_id()
);

CREATE POLICY "Doctors can view their own data" 
ON public.doctors 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = doctors.profile_id 
        AND profiles.user_id = auth.uid()
    )
    AND organization_id = get_current_user_organization_id()
);

CREATE POLICY "Doctors can update their own data" 
ON public.doctors 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = doctors.profile_id 
        AND profiles.user_id = auth.uid()
    )
    AND organization_id = get_current_user_organization_id()
);

-- 4. Actualizar políticas RLS en APPOINTMENTS
DROP POLICY IF EXISTS "Admins can manage all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can manage their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can view their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can view their own appointments" ON public.appointments;

CREATE POLICY "Admins can manage appointments in their organization" 
ON public.appointments 
FOR ALL 
USING (
    is_admin(auth.uid()) 
    AND organization_id = get_current_user_organization_id()
);

CREATE POLICY "Doctors can manage their appointments in their organization" 
ON public.appointments 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM doctors d
        JOIN profiles pr ON d.profile_id = pr.id
        WHERE d.id = appointments.doctor_id 
        AND pr.user_id = auth.uid()
        AND d.organization_id = get_current_user_organization_id()
    )
    AND organization_id = get_current_user_organization_id()
);

CREATE POLICY "Patients can view their appointments in their organization" 
ON public.appointments 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM patients p
        JOIN profiles pr ON p.profile_id = pr.id
        WHERE p.id = appointments.patient_id 
        AND pr.user_id = auth.uid()
        AND p.organization_id = get_current_user_organization_id()
    )
    AND organization_id = get_current_user_organization_id()
);

CREATE POLICY "Patients can create appointments in their organization" 
ON public.appointments 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM patients p
        JOIN profiles pr ON p.profile_id = pr.id
        WHERE p.id = appointments.patient_id 
        AND pr.user_id = auth.uid()
        AND p.organization_id = get_current_user_organization_id()
    )
    AND organization_id = get_current_user_organization_id()
);