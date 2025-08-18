-- Add fields to appointments table to handle no-show scenarios
ALTER TABLE public.appointments 
ADD COLUMN no_show_reason TEXT,
ADD COLUMN session_deducted BOOLEAN DEFAULT false;

-- Update appointment_status enum to include new no-show statuses
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'no_show_rescheduled';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'no_show_session_lost';