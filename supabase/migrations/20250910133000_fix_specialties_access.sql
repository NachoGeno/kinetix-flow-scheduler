-- Fix specialties access: Allow all authenticated users to read specialties
-- but keep write restrictions for admins only

-- ============== SPECIALTIES TABLE - FIX ACCESS ==============
-- Drop the restrictive organization isolation policy for SELECT
DROP POLICY IF EXISTS "Organization isolation - specialties select" ON public.specialties;

-- Create a new policy that allows all authenticated users to view all specialties
-- This enables creating professionals with any specialty across organizations
CREATE POLICY "Authenticated users can view all specialties" ON public.specialties  
FOR SELECT TO authenticated USING (true);

-- Keep the restrictive policies for INSERT, UPDATE, DELETE (admin only)
-- These remain unchanged to maintain data integrity
