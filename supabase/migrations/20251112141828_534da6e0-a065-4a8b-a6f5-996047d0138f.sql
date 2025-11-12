-- Grant execute permissions for patient search RPC functions
-- This ensures frontend can call these functions via authenticated/anon roles

GRANT EXECUTE ON FUNCTION public.search_patients_paginated(text, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_organization_id() TO authenticated, anon;