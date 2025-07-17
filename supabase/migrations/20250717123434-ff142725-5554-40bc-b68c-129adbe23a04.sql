-- Make user_id nullable in profiles table for patient profiles
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Add a new foreign key constraint that allows null values
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies to handle null user_id for patients
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- New policies that handle both authenticated users and patient profiles
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
    auth.uid() = user_id OR 
    (role = 'patient' AND user_id IS NULL)
);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (
    auth.uid() = user_id OR 
    (role = 'patient' AND is_admin(auth.uid()))
);

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (
    auth.uid() = user_id OR 
    (role = 'patient' AND (is_admin(auth.uid()) OR get_user_role(auth.uid()) = 'doctor'))
);