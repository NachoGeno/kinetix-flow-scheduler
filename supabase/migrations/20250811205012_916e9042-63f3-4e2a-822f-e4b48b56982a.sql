-- Create email settings tables
CREATE TABLE IF NOT EXISTS public.email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_sender_name text NOT NULL DEFAULT 'Mediturnos',
  default_sender_email text NOT NULL,
  reply_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_social_art_id uuid REFERENCES public.obras_sociales_art(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  email_type text NOT NULL CHECK (email_type IN ('presentation','social_appointments')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recipients ENABLE ROW LEVEL SECURITY;

-- Policies (admins manage all)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_settings' AND policyname = 'Admins can manage email_settings'
  ) THEN
    CREATE POLICY "Admins can manage email_settings" ON public.email_settings
    FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_recipients' AND policyname = 'Admins can manage email_recipients'
  ) THEN
    CREATE POLICY "Admins can manage email_recipients" ON public.email_recipients
    FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
  END IF;
END $$;

-- Timestamp trigger function already exists as public.update_updated_at_column
-- Create triggers to auto-update updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_email_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_email_settings_updated_at
    BEFORE UPDATE ON public.email_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_email_recipients_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_email_recipients_updated_at
    BEFORE UPDATE ON public.email_recipients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
