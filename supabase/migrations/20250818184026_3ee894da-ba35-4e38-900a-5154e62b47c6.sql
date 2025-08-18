-- Fix RLS policies for novedades - simplify and use security definer function
DROP POLICY IF EXISTS "Authenticated users can create novedades" ON public.novedades;
DROP POLICY IF EXISTS "Users can update their own novedades" ON public.novedades;

-- Create a security definer function to get current user's profile id
CREATE OR REPLACE FUNCTION public.get_current_user_profile_id()
RETURNS UUID AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create simplified policies using the security definer function
CREATE POLICY "Authenticated users can create novedades" 
ON public.novedades 
FOR INSERT 
WITH CHECK (autor_id = get_current_user_profile_id());

CREATE POLICY "Users can update their own novedades" 
ON public.novedades 
FOR UPDATE 
USING (autor_id = get_current_user_profile_id());