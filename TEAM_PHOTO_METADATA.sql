-- Team photo metadata: optional second team + neutral flag. Run HOMEPAGE_BANNERS.sql first.
-- Apply manually in the Supabase SQL Editor. Safe to re-run (also upgrades an earlier run of this file).
--
-- team_id          = Team 1, always the visual focus of the photo (unchanged).
-- second_team_id  = Team 2 in the photo, optional.
-- is_neutral      = Team 1 is not meant to be read as the focus; only valid with a Team 2.
-- Existing rows get second_team_id NULL / is_neutral false, i.e. they stay single-team photos.
--
-- Team deletion: both team foreign keys become ON DELETE RESTRICT, so a team that is still
-- referenced by a photo cannot be deleted (and its photo records are never cascade-deleted,
-- which would also orphan the files in storage). Delete or reassign the photos first.

ALTER TABLE team_photos ADD COLUMN IF NOT EXISTS second_team_id TEXT;
ALTER TABLE team_photos ADD COLUMN IF NOT EXISTS is_neutral BOOLEAN NOT NULL DEFAULT FALSE;

-- Replace whatever foreign keys team_photos has to teams (the original CASCADE one on
-- team_id, and a CASCADE one on second_team_id if an earlier version of this file ran).
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.team_photos'::regclass
      AND contype = 'f'
      AND confrelid = 'public.teams'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.team_photos DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END $$;

ALTER TABLE team_photos ADD CONSTRAINT team_photos_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE RESTRICT;
ALTER TABLE team_photos ADD CONSTRAINT team_photos_second_team_id_fkey
  FOREIGN KEY (second_team_id) REFERENCES teams(team_id) ON DELETE RESTRICT;

ALTER TABLE team_photos DROP CONSTRAINT IF EXISTS team_photos_teams_differ;
ALTER TABLE team_photos ADD CONSTRAINT team_photos_teams_differ
  CHECK (second_team_id IS NULL OR second_team_id <> team_id);

ALTER TABLE team_photos DROP CONSTRAINT IF EXISTS team_photos_neutral_needs_second_team;
ALTER TABLE team_photos ADD CONSTRAINT team_photos_neutral_needs_second_team
  CHECK (NOT is_neutral OR second_team_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS team_photos_second_team_active
  ON team_photos (second_team_id, is_active)
  WHERE second_team_id IS NOT NULL;

-- Column-level grants (see HOMEPAGE_BANNERS.sql): expose only the new public columns.
GRANT SELECT (second_team_id, is_neutral) ON team_photos TO anon, authenticated;
