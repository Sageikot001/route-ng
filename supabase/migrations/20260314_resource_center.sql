-- Resource Center for Admin-uploaded learning materials
-- Resources can target managers, iOS users (partners), or both

-- Resource type enum
CREATE TYPE resource_type AS ENUM ('video', 'image', 'text');

-- Target audience enum
CREATE TYPE resource_audience AS ENUM ('managers', 'partners', 'all');

-- Resources table
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  resource_type resource_type NOT NULL,
  target_audience resource_audience NOT NULL DEFAULT 'all',

  -- Content fields (use based on type)
  content_text TEXT,                    -- For text resources
  file_url TEXT,                        -- For video/image uploads
  external_url TEXT,                    -- For external video links (YouTube, etc.)
  thumbnail_url TEXT,                   -- Optional thumbnail for videos

  -- Metadata
  file_size INTEGER,                    -- File size in bytes
  duration INTEGER,                     -- Video duration in seconds

  -- Organization
  category VARCHAR(100),                -- e.g., "Getting Started", "Transactions", "Payouts"
  sort_order INTEGER DEFAULT 0,         -- For manual ordering
  is_published BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,

  -- Tracking
  view_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resource views tracking (optional - for analytics)
CREATE TABLE resource_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_resources_audience ON resources(target_audience);
CREATE INDEX idx_resources_type ON resources(resource_type);
CREATE INDEX idx_resources_published ON resources(is_published);
CREATE INDEX idx_resources_category ON resources(category);
CREATE INDEX idx_resources_sort ON resources(sort_order);
CREATE INDEX idx_resource_views_resource ON resource_views(resource_id);
CREATE INDEX idx_resource_views_user ON resource_views(user_id);

-- Enable RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resources

-- Admins can do everything
CREATE POLICY "Admins full access to resources"
  ON resources FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Managers can view published resources targeted to them or all
CREATE POLICY "Managers can view their resources"
  ON resources FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND target_audience IN ('managers', 'all')
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'manager'
    )
  );

-- iOS users can view published resources targeted to them or all
CREATE POLICY "iOS users can view their resources"
  ON resources FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND target_audience IN ('partners', 'all')
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ios_user'
    )
  );

-- RLS Policies for resource_views

-- Users can insert their own views
CREATE POLICY "Users can record their views"
  ON resource_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can view their own view history
CREATE POLICY "Users can view their own history"
  ON resource_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all resource views
CREATE POLICY "Admins can view all resource views"
  ON resource_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION update_resources_updated_at();

-- Create storage bucket for resource files
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for resources bucket
CREATE POLICY "Admins can upload resources"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resources'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update resources"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete resources"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Anyone can view resources"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'resources');
