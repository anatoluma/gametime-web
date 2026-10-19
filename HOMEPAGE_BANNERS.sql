-- Homepage banners, phase 1: team action photo library + banner table.
-- Apply manually in the Supabase SQL Editor (no migration runner in this repo). Safe to re-run.

-- ---------------------------------------------------------------------------
-- Team photos (admin media library). storage_path is relative to the bucket.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_photos (
  photo_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       TEXT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL UNIQUE,
  original_name TEXT,
  content_type  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL CHECK (size_bytes > 0),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  uploaded_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_photos_team_active
  ON team_photos (team_id, is_active);

-- ---------------------------------------------------------------------------
-- Homepage banners. One row per game; generated files are versioned so a
-- regeneration never serves a stale CDN copy.
-- game_id has no FK, matching the rest of the project (see games / player_game_stats).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homepage_banners (
  banner_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'approved', 'rejected')),
  photo_id       UUID REFERENCES team_photos(photo_id) ON DELETE SET NULL,
  headline       TEXT,
  image_path     TEXT,
  image_version  INTEGER NOT NULL DEFAULT 0 CHECK (image_version >= 0),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  generated_at   TIMESTAMPTZ,
  reviewed_by    TEXT,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- An approved banner must have a generated image to show.
  CONSTRAINT homepage_banners_approved_has_image
    CHECK (status <> 'approved' OR image_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS homepage_banners_status_order
  ON homepage_banners (status, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS homepage_banners_photo
  ON homepage_banners (photo_id);

-- ---------------------------------------------------------------------------
-- RLS: the public site reads only what is published; all writes use the service role.
-- ---------------------------------------------------------------------------
ALTER TABLE team_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active team_photos" ON team_photos;
CREATE POLICY "Public read active team_photos"
  ON team_photos FOR SELECT TO anon USING (is_active);

DROP POLICY IF EXISTS "Service role manages team_photos" ON team_photos;
CREATE POLICY "Service role manages team_photos"
  ON team_photos FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read approved homepage_banners" ON homepage_banners;
CREATE POLICY "Public read approved homepage_banners"
  ON homepage_banners FOR SELECT TO anon USING (status = 'approved');

DROP POLICY IF EXISTS "Service role manages homepage_banners" ON homepage_banners;
CREATE POLICY "Service role manages homepage_banners"
  ON homepage_banners FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Storage buckets (public read; uploads only via the service role).
-- Paths: team-photos/<TEAM_ID>/<uuid>.<ext>, banners/<game_id>/v<image_version>.png
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('team-photos', 'team-photos', true, 10485760,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('banners', 'banners', true, 5242880,
   ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
