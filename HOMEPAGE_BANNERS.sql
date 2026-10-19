-- Homepage banners, phase 1: team action photo library + banner table.
-- Apply manually in the Supabase SQL Editor (no migration runner in this repo). Safe to re-run.
--
-- Authorization model: all writes go through /api/admin/* routes, which check
-- requireAdmin()/requireSuperAdmin() (ADMIN_EMAILS / SUPER_ADMIN_EMAILS env vars, never SQL)
-- and then use the service-role key. service_role bypasses RLS and storage policies, so the
-- policies below only need to constrain the anon and authenticated roles.

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
--
-- Draft/publish storage split:
--   image_path     -> private bucket `banner-drafts`, path <game_id>/v<image_version>.png
--   published_path -> public bucket  `banners`,       same path, copied on approval and
--                     removed on reject/unpublish, so unapproved images have no public URL.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS homepage_banners (
  banner_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'approved', 'rejected')),
  photo_id        UUID REFERENCES team_photos(photo_id) ON DELETE SET NULL,
  headline        TEXT,
  image_path      TEXT,
  published_path  TEXT,
  image_version   INTEGER NOT NULL DEFAULT 0 CHECK (image_version >= 0),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  generated_at    TIMESTAMPTZ,
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Also upgrades a table created by the first version of this file.
ALTER TABLE homepage_banners ADD COLUMN IF NOT EXISTS published_path TEXT;

-- An approved banner must have a published (public) image to show.
ALTER TABLE homepage_banners DROP CONSTRAINT IF EXISTS homepage_banners_approved_has_image;
ALTER TABLE homepage_banners ADD CONSTRAINT homepage_banners_approved_has_image
  CHECK (status <> 'approved' OR published_path IS NOT NULL);

CREATE INDEX IF NOT EXISTS homepage_banners_status_order
  ON homepage_banners (status, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS homepage_banners_photo
  ON homepage_banners (photo_id);

CREATE OR REPLACE FUNCTION homepage_banners_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS homepage_banners_touch_updated_at ON homepage_banners;
CREATE TRIGGER homepage_banners_touch_updated_at
  BEFORE UPDATE ON homepage_banners
  FOR EACH ROW EXECUTE FUNCTION homepage_banners_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: the public site reads only what is published. Both anon (visitors) and
-- authenticated (a logged-in admin browsing the public site carries an
-- authenticated JWT) get the same read-only view. No client write policies exist.
-- ---------------------------------------------------------------------------
ALTER TABLE team_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active team_photos" ON team_photos;
CREATE POLICY "Public read active team_photos"
  ON team_photos FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "Service role manages team_photos" ON team_photos;
CREATE POLICY "Service role manages team_photos"
  ON team_photos FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read approved homepage_banners" ON homepage_banners;
CREATE POLICY "Public read approved homepage_banners"
  ON homepage_banners FOR SELECT TO anon, authenticated USING (status = 'approved');

DROP POLICY IF EXISTS "Service role manages homepage_banners" ON homepage_banners;
CREATE POLICY "Service role manages homepage_banners"
  ON homepage_banners FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Grants: defence in depth on top of RLS. Supabase's default privileges give
-- anon/authenticated full table access, so strip it, then grant read on public
-- columns only (keeps uploaded_by / reviewed_by admin emails and draft paths
-- out of PostgREST). Public queries must list columns; `select *` will be denied.
-- ---------------------------------------------------------------------------
REVOKE ALL ON team_photos, homepage_banners FROM anon, authenticated;

GRANT SELECT (photo_id, team_id, storage_path, is_active, created_at)
  ON team_photos TO anon, authenticated;

GRANT SELECT (banner_id, game_id, status, headline, published_path, image_version,
              sort_order, reviewed_at, updated_at)
  ON homepage_banners TO anon, authenticated;

GRANT ALL ON team_photos, homepage_banners TO service_role;

-- ---------------------------------------------------------------------------
-- Storage buckets.
--   team-photos   public  <TEAM_ID>/<uuid>.<ext>
--   banners       public  published (approved) banners only
--   banner-drafts private drafts; the admin UI previews them via server-created signed URLs
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('team-photos', 'team-photos', true, 10485760,
   ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('banners', 'banners', true, 5242880,
   ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('banner-drafts', 'banner-drafts', false, 5242880,
   ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public buckets serve reads by URL without storage policies, and service_role bypasses
-- storage RLS, so no permissive policies are needed. This restrictive policy guarantees that
-- anon/authenticated can never list, upload, overwrite or delete in these three buckets, even
-- if a broad permissive policy on storage.objects exists elsewhere. Other buckets are untouched.
DROP POLICY IF EXISTS "Banner buckets are server-managed only" ON storage.objects;
CREATE POLICY "Banner buckets are server-managed only"
  ON storage.objects AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id NOT IN ('team-photos', 'banners', 'banner-drafts'))
  WITH CHECK (bucket_id NOT IN ('team-photos', 'banners', 'banner-drafts'));
