-- Security Fix 1: Remove public access to obras_sociales_art and restrict to authenticated users
DROP POLICY IF EXISTS "Anyone can view active obras_sociales_art" ON obras_sociales_art;

CREATE POLICY "Authenticated users can view active obras_sociales_art" 
ON obras_sociales_art 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- Security Fix 2: Prevent users from updating their own role (privilege escalation)
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile (except role)" 
ON profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND (
  -- Users can only change their role if they are admin, otherwise role must stay the same
  is_admin(auth.uid()) OR 
  NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role != 'admin')
));

-- Security Fix 3: Optionally restrict specialties to authenticated users
DROP POLICY IF EXISTS "Anyone can view specialties" ON specialties;

CREATE POLICY "Authenticated users can view specialties" 
ON specialties 
FOR SELECT 
TO authenticated
USING (true);