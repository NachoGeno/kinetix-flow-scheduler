-- Remove the overly permissive policy that allows public access to doctors
DROP POLICY IF EXISTS "Anyone can view active doctors" ON public.doctors;

-- Create a new policy that only allows authenticated users to view active doctors
CREATE POLICY "Authenticated users can view active doctors" 
ON public.doctors 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- Ensure reception staff can also view doctors for appointment management
CREATE POLICY "Reception can view all doctors" 
ON public.doctors 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'reception')
  )
);