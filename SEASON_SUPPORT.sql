-- ============================================================
-- Multi-Season Support Migration
-- Run this in the Supabase SQL editor (or via psql)
-- ============================================================

-- 1. seasons master table -----------------------------------------

CREATE TABLE IF NOT EXISTS seasons (
  season     VARCHAR PRIMARY KEY,   -- e.g. '2025/26'
  is_current BOOLEAN NOT NULL DEFAULT false,
  label      VARCHAR,               -- optional display label
  start_date DATE
);

-- Enforce at most one current season at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS seasons_single_current
  ON seasons (is_current)
  WHERE is_current = true;

-- 2. player_seasons — team/jersey per player per season ------------

CREATE TABLE IF NOT EXISTS player_seasons (
  player_id    TEXT     NOT NULL REFERENCES players(player_id)  ON DELETE CASCADE,
  season       VARCHAR  NOT NULL REFERENCES seasons(season)     ON DELETE CASCADE,
  team_id      TEXT     NOT NULL REFERENCES teams(team_id)      ON DELETE RESTRICT,
  jersey_number SMALLINT,
  is_active    BOOLEAN  NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, season)
);

CREATE INDEX IF NOT EXISTS player_seasons_season_team
  ON player_seasons (season, team_id);

-- 3. RLS policies ------------------------------------------------

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read seasons"
  ON seasons FOR SELECT TO anon USING (true);

CREATE POLICY "Service role manages seasons"
  ON seasons FOR ALL TO service_role USING (true);


ALTER TABLE player_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read player_seasons"
  ON player_seasons FOR SELECT TO anon USING (true);

CREATE POLICY "Service role manages player_seasons"
  ON player_seasons FOR ALL TO service_role USING (true);

-- 4. Seed season data --------------------------------------------

INSERT INTO seasons (season, is_current) VALUES
  ('2025/26', true),
  ('2026/27', false)
ON CONFLICT (season) DO NOTHING;

-- 5. Populate player_seasons for 2025/26 from existing players ----
-- Copies current team + jersey from the players table.
-- Re-run is safe (ON CONFLICT DO NOTHING).

INSERT INTO player_seasons (player_id, season, team_id, jersey_number)
SELECT
  p.player_id,
  '2025/26',
  p.team_id,
  p.jersey_number
FROM players p
WHERE p.team_id IS NOT NULL
ON CONFLICT (player_id, season) DO NOTHING;
