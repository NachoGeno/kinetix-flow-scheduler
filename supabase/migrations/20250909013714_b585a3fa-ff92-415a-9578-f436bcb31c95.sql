-- Corregir las políticas RLS para asegurar separación completa por organización

-- ============== PATIENTS TABLE ==============
-- Eliminar políticas existentes y crear nuevas más estrictas
DROP POLICY IF EXISTS "Admins can manage patients in their organization" ON public.patients;
DROP POLICY IF EXISTS "Doctors can view patients in their organization" ON public.patients; 
DROP POLICY IF EXISTS "Patients can update their own data" ON public.patients;
DROP POLICY IF EXISTS "Patients can view their own data" ON public.patients;

-- Nuevas políticas más estrictas para patients
CREATE POLICY "Organization isolation - patients select" ON public.patients
FOR SELECT USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - patients insert" ON public.patients  
FOR INSERT WITH CHECK (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - patients update" ON public.patients
FOR UPDATE USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - patients delete" ON public.patients
FOR DELETE USING (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

-- ============== DOCTORS TABLE ==============
-- Eliminar políticas existentes y crear nuevas más estrictas  
DROP POLICY IF EXISTS "Admins can manage doctors in their organization" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update their own data" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can view their own data" ON public.doctors;
DROP POLICY IF EXISTS "Users can view active doctors in their organization" ON public.doctors;

-- Nuevas políticas más estrictas para doctors
CREATE POLICY "Organization isolation - doctors select" ON public.doctors
FOR SELECT USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - doctors insert" ON public.doctors
FOR INSERT WITH CHECK (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

CREATE POLICY "Organization isolation - doctors update" ON public.doctors  
FOR UPDATE USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - doctors delete" ON public.doctors
FOR DELETE USING (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

-- ============== APPOINTMENTS TABLE ==============
-- Eliminar políticas existentes y crear nuevas más estrictas
DROP POLICY IF EXISTS "Admins can manage appointments in their organization" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can manage their appointments in their organization" ON public.appointments;
DROP POLICY IF EXISTS "Patients can create appointments in their organization" ON public.appointments;
DROP POLICY IF EXISTS "Patients can view their appointments in their organization" ON public.appointments;

-- Nuevas políticas más estrictas para appointments
CREATE POLICY "Organization isolation - appointments select" ON public.appointments
FOR SELECT USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - appointments insert" ON public.appointments
FOR INSERT WITH CHECK (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - appointments update" ON public.appointments
FOR UPDATE USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - appointments delete" ON public.appointments  
FOR DELETE USING (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

-- ============== MEDICAL ORDERS TABLE ==============
-- Eliminar políticas existentes y crear nuevas más estrictas
DROP POLICY IF EXISTS "Admins can manage all medical orders" ON public.medical_orders;
DROP POLICY IF EXISTS "Doctors can manage medical orders" ON public.medical_orders;
DROP POLICY IF EXISTS "Patients can view their own medical orders" ON public.medical_orders;

-- Nuevas políticas más estrictas para medical_orders  
CREATE POLICY "Organization isolation - medical_orders select" ON public.medical_orders
FOR SELECT USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - medical_orders insert" ON public.medical_orders
FOR INSERT WITH CHECK (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - medical_orders update" ON public.medical_orders
FOR UPDATE USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - medical_orders delete" ON public.medical_orders
FOR DELETE USING (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

-- ============== SPECIALTIES TABLE ==============
-- Eliminar políticas existentes y crear nuevas más estrictas
DROP POLICY IF EXISTS "Authenticated users can view specialties" ON public.specialties;
DROP POLICY IF EXISTS "Only admins can manage specialties" ON public.specialties;

-- Nuevas políticas más estrictas para specialties
CREATE POLICY "Organization isolation - specialties select" ON public.specialties  
FOR SELECT USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - specialties insert" ON public.specialties
FOR INSERT WITH CHECK (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

CREATE POLICY "Organization isolation - specialties update" ON public.specialties
FOR UPDATE USING (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

CREATE POLICY "Organization isolation - specialties delete" ON public.specialties  
FOR DELETE USING (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

-- ============== OBRAS SOCIALES TABLE ==============
-- Eliminar políticas existentes y crear nuevas más estrictas
DROP POLICY IF EXISTS "Admins can manage all obras_sociales_art" ON public.obras_sociales_art;
DROP POLICY IF EXISTS "Authenticated users can view active obras_sociales_art" ON public.obras_sociales_art;
DROP POLICY IF EXISTS "Doctors can view all obras_sociales_art" ON public.obras_sociales_art;

-- Nuevas políticas más estrictas para obras_sociales_art
CREATE POLICY "Organization isolation - obras_sociales select" ON public.obras_sociales_art
FOR SELECT USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - obras_sociales insert" ON public.obras_sociales_art  
FOR INSERT WITH CHECK (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

CREATE POLICY "Organization isolation - obras_sociales update" ON public.obras_sociales_art
FOR UPDATE USING (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

CREATE POLICY "Organization isolation - obras_sociales delete" ON public.obras_sociales_art
FOR DELETE USING (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

-- ============== NOVEDADES TABLE ==============
-- Eliminar políticas existentes y crear nuevas más estrictas
DROP POLICY IF EXISTS "Admins can delete novedades" ON public.novedades;
DROP POLICY IF EXISTS "Authenticated users can create novedades" ON public.novedades;
DROP POLICY IF EXISTS "Authenticated users can view all novedades" ON public.novedades;  
DROP POLICY IF EXISTS "Users can update their own novedades" ON public.novedades;

-- Nuevas políticas más estrictas para novedades
CREATE POLICY "Organization isolation - novedades select" ON public.novedades
FOR SELECT USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - novedades insert" ON public.novedades
FOR INSERT WITH CHECK (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - novedades update" ON public.novedades  
FOR UPDATE USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - novedades delete" ON public.novedades
FOR DELETE USING (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));

-- ============== UNIFIED MEDICAL HISTORIES TABLE ==============
-- Eliminar políticas existentes y crear nuevas más estrictas
DROP POLICY IF EXISTS "Admins can manage all unified medical histories" ON public.unified_medical_histories;
DROP POLICY IF EXISTS "Doctors can manage their unified medical histories" ON public.unified_medical_histories;
DROP POLICY IF EXISTS "Patients can view their unified medical histories" ON public.unified_medical_histories;

-- Nuevas políticas más estrictas para unified_medical_histories
CREATE POLICY "Organization isolation - unified_medical_histories select" ON public.unified_medical_histories
FOR SELECT USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - unified_medical_histories insert" ON public.unified_medical_histories
FOR INSERT WITH CHECK (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - unified_medical_histories update" ON public.unified_medical_histories
FOR UPDATE USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Organization isolation - unified_medical_histories delete" ON public.unified_medical_histories  
FOR DELETE USING (organization_id = get_current_user_organization_id() AND is_admin(auth.uid()));