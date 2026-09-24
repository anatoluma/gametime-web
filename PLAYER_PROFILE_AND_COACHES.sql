-- Player profile fields and season-scoped coach assignments.
-- Run manually in the Supabase SQL editor. Safe to re-run.

BEGIN;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS birth_year SMALLINT,
  ADD COLUMN IF NOT EXISTS height_cm SMALLINT,
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS position TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_birth_year_range') THEN
    ALTER TABLE public.players ADD CONSTRAINT players_birth_year_range
      CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_birth_date_year_matches') THEN
    ALTER TABLE public.players ADD CONSTRAINT players_birth_date_year_matches
      CHECK (birth_date IS NULL OR birth_year IS NULL OR EXTRACT(YEAR FROM birth_date)::smallint = birth_year);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.team_season_coaches (
  team_id TEXT NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
  season VARCHAR NOT NULL REFERENCES public.seasons(season) ON DELETE CASCADE,
  coach_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, season)
);

CREATE INDEX IF NOT EXISTS team_season_coaches_season
  ON public.team_season_coaches (season, team_id);

ALTER TABLE public.team_season_coaches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_season_coaches' AND policyname = 'Public read team season coaches') THEN
    CREATE POLICY "Public read team season coaches" ON public.team_season_coaches FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'team_season_coaches' AND policyname = 'Service role manages team season coaches') THEN
    CREATE POLICY "Service role manages team season coaches" ON public.team_season_coaches FOR ALL TO service_role USING (true);
  END IF;
END $$;

COMMIT;