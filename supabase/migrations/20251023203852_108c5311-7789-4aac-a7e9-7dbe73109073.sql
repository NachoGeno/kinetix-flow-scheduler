-- Tabla de feriados
CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  is_national BOOLEAN DEFAULT false,
  recurring BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, date)
);

-- RLS Policies
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization holidays"
  ON holidays FOR SELECT
  USING (organization_id = get_current_user_organization_id());

CREATE POLICY "Admins can manage holidays"
  ON holidays FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Índices para optimizar consultas
CREATE INDEX idx_holidays_org_date ON holidays(organization_id, date);
CREATE INDEX idx_holidays_active ON holidays(is_active) WHERE is_active = true;