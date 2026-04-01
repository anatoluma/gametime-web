BEGIN;

-- Keep existing game IDs and current app queries.
-- This migration expands the current schema instead of introducing parallel tables.

-- -----------------------------------------------------------------------------
-- 1. processing_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id UUID PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  season_id INTEGER,
  competition_id INTEGER,
  raw_file_path TEXT NOT NULL,
  extraction_json JSONB,
  validation_json JSONB,
  resolution_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at TIMESTAMPTZ,
  committed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_status
  ON public.processing_jobs(status);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at
  ON public.processing_jobs(created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. player_aliases
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_aliases (
  id BIGSERIAL PRIMARY KEY,
  alias_name VARCHAR(100) NOT NULL,
  player_id TEXT NOT NULL REFERENCES public.players(player_id),
  confidence DECIMAL(4,3),
  resolution_method VARCHAR(20),
  confirmed_by TEXT,
  source_job_id UUID REFERENCES public.processing_jobs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(alias_name, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_aliases_alias_name
  ON public.player_aliases(alias_name);

CREATE INDEX IF NOT EXISTS idx_player_aliases_player_id
  ON public.player_aliases(player_id);

-- -----------------------------------------------------------------------------
-- 3. Expand games for OCR metadata while preserving existing game_id usage
-- -----------------------------------------------------------------------------
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS source_job_id UUID REFERENCES public.processing_jobs(id),
  ADD COLUMN IF NOT EXISTS competition_id INTEGER,
  ADD COLUMN IF NOT EXISTS game_number INTEGER,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS crew_chief VARCHAR(100),
  ADD COLUMN IF NOT EXISTS umpires TEXT[],
  ADD COLUMN IF NOT EXISTS score_intervals JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_games_source_job_id
  ON public.games(source_job_id);

-- -----------------------------------------------------------------------------
-- 4. Expand player_game_stats in place instead of creating game_player_stats
-- -----------------------------------------------------------------------------
ALTER TABLE public.player_game_stats
  ADD COLUMN IF NOT EXISTS source_job_id UUID REFERENCES public.processing_jobs(id),
  ADD COLUMN IF NOT EXISTS is_starter BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_captain BOOLEAN,
  ADD COLUMN IF NOT EXISTS dnp BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS minutes VARCHAR(6),
  ADD COLUMN IF NOT EXISTS fg_made SMALLINT,
  ADD COLUMN IF NOT EXISTS fg_att SMALLINT,
  ADD COLUMN IF NOT EXISTS two_made SMALLINT,
  ADD COLUMN IF NOT EXISTS two_att SMALLINT,
  ADD COLUMN IF NOT EXISTS three_made SMALLINT,
  ADD COLUMN IF NOT EXISTS three_att SMALLINT,
  ADD COLUMN IF NOT EXISTS ft_made SMALLINT,
  ADD COLUMN IF NOT EXISTS ft_att SMALLINT,
  ADD COLUMN IF NOT EXISTS reb_off SMALLINT,
  ADD COLUMN IF NOT EXISTS reb_def SMALLINT,
  ADD COLUMN IF NOT EXISTS reb_tot SMALLINT,
  ADD COLUMN IF NOT EXISTS assists SMALLINT,
  ADD COLUMN IF NOT EXISTS turnovers SMALLINT,
  ADD COLUMN IF NOT EXISTS steals SMALLINT,
  ADD COLUMN IF NOT EXISTS blocks SMALLINT,
  ADD COLUMN IF NOT EXISTS fouls_personal SMALLINT,
  ADD COLUMN IF NOT EXISTS fouls_drawn SMALLINT,
  ADD COLUMN IF NOT EXISTS plus_minus SMALLINT,
  ADD COLUMN IF NOT EXISTS efficiency SMALLINT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_player_game_stats_game_id
  ON public.player_game_stats(game_id);

CREATE INDEX IF NOT EXISTS idx_player_game_stats_player_id
  ON public.player_game_stats(player_id);

CREATE INDEX IF NOT EXISTS idx_player_game_stats_source_job_id
  ON public.player_game_stats(source_job_id);

-- -----------------------------------------------------------------------------
-- 5. New team summary table for stats that do not belong on player_game_stats
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_team_summary (
  id BIGSERIAL PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES public.games(game_id) ON DELETE CASCADE,
  source_job_id UUID REFERENCES public.processing_jobs(id),
  team_id TEXT NOT NULL REFERENCES public.teams(team_id),
  points_from_turnovers SMALLINT,
  points_in_paint SMALLINT,
  points_in_paint_att SMALLINT,
  points_in_paint_pct DECIMAL(4,1),
  second_chance_points SMALLINT,
  fast_break_points SMALLINT,
  bench_points SMALLINT,
  biggest_lead SMALLINT,
  biggest_lead_score VARCHAR(20),
  biggest_scoring_run SMALLINT,
  biggest_scoring_run_score VARCHAR(20),
  lead_changes SMALLINT,
  times_tied SMALLINT,
  time_with_lead VARCHAR(6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_game_team_summary_game_id
  ON public.game_team_summary(game_id);

CREATE INDEX IF NOT EXISTS idx_game_team_summary_source_job_id
  ON public.game_team_summary(source_job_id);

COMMIT;