-- Add structured schedule fields to doctors table
ALTER TABLE public.doctors ADD COLUMN work_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
ALTER TABLE public.doctors ADD COLUMN work_start_time TIME DEFAULT '08:00:00';
ALTER TABLE public.doctors ADD COLUMN work_end_time TIME DEFAULT '17:00:00';
ALTER TABLE public.doctors ADD COLUMN appointment_duration INTEGER DEFAULT 30; -- minutes per appointment

-- Add hire_date to track when professional started
ALTER TABLE public.doctors ADD COLUMN hire_date DATE DEFAULT CURRENT_DATE;