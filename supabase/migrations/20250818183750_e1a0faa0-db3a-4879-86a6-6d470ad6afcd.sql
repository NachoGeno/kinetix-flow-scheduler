-- Update RLS policies for novedades to use the correct relationship
DROP POLICY IF EXISTS "Authenticated users can create novedades" ON public.novedades;
DROP POLICY IF EXISTS "Users can update their own novedades" ON public.novedades;

-- Create new policies with correct user reference
CREATE POLICY "Authenticated users can create novedades" 
ON public.novedades 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.id = autor_id
  )
);

CREATE POLICY "Users can update their own novedades" 
ON public.novedades 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.id = autor_id
  )
);