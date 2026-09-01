-- Team season membership table
-- This stores which teams are active for each season without mutating the canonical teams table.

CREATE TABLE IF NOT EXISTS team_seasons (
  team_id   TEXT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  season    VARCHAR NOT NULL REFERENCES seasons(season) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, season)
);

CREATE INDEX IF NOT EXISTS team_seasons_season_team
  ON team_seasons (season, team_id);

ALTER TABLE team_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read team_seasons"
  ON team_seasons FOR SELECT TO anon USING (true);

CREATE POLICY "Service role manages team_seasons"
  ON team_seasons FOR ALL TO service_role USING (true);

-- Optional seeding for the current season from the canonical teams table.
-- Leave it commented unless you intentionally want a pre-populated current-season list.
-- INSERT INTO team_seasons (team_id, season, is_active)
-- SELECT t.team_id, '2026/27', true
-- FROM teams t
-- ON CONFLICT (team_id, season) DO NOTHING;
