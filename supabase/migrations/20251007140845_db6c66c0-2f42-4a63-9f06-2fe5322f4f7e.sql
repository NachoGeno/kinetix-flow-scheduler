-- Drop the old overloaded versions of RPC functions that are causing conflicts
-- These had the obra_social_filter parameter which is no longer needed

-- Drop old version of get_new_patients_by_month with obra_social_filter
DROP FUNCTION IF EXISTS public.get_new_patients_by_month(start_date date, end_date date, obra_social_filter uuid);

-- Drop old version of get_active_patients_in_treatment with date and obra_social_filter parameters
DROP FUNCTION IF EXISTS public.get_active_patients_in_treatment(start_date date, end_date date, obra_social_filter uuid);

-- Drop old version of get_patients_without_closed_history with date and obra_social_filter parameters
DROP FUNCTION IF EXISTS public.get_patients_without_closed_history(start_date date, end_date date, obra_social_filter uuid);