-- REQUIRED MIGRATION (idempotent): atomic box-score commit.
-- Called only by src/lib/commit.ts through the service-role client, after requireAdmin() and the
-- application-level integrity check (src/lib/commit-integrity.ts). Supersedes
-- replace_game_player_stats (see rollback / cleanup at the bottom).
--
-- One call = one transaction. It writes, in this order:
--   1. games              (upsert)
--   2. game_details       (upsert)
--   3. player_game_stats  (delete this game's rows, insert the new ones)
--   4. game_team_summary  (upsert per team)
--   5. processing_jobs    (status -> committed)
-- Any exception at any step (including constraint, trigger or consistency failures) rolls back ALL of
-- it, so previously committed rows are never lost. Banner generation is NOT part of the transaction;
-- the application runs it afterwards and its failure cannot affect the commit.
--
-- Concurrency / repeats: the job row is locked FOR UPDATE and a per-game advisory lock serializes
-- different jobs targeting the same game. A repeated or concurrent call for an already committed job
-- returns {already_committed: true} and changes nothing.
--
-- Independent consistency checks (enforced here even if the application check is bypassed):
--   * job exists and is 'approved' (or already 'committed' by this very job)
--   * game id, teams, season and both final scores present; home <> away
--   * stats are a non-empty array, all rows belong to the game, every team is the home or away team
--   * every row has a player_id and non-null points; no duplicate player_id
--   * every player_id has an ACTIVE player_seasons row for the game's season on the row's team
--   * per-team sum(points) equals the final score
--   * optional p_expected_players equals the number of rows

CREATE OR REPLACE FUNCTION public.commit_box_score(
  p_job_id uuid,
  p_game jsonb,
  p_details jsonb,
  p_stats jsonb,
  p_team_summary jsonb DEFAULT '[]'::jsonb,
  p_expected_players integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_game_id text;
  v_home text;
  v_away text;
  v_season text;
  v_home_score integer;
  v_away_score integer;
  v_count integer;
  v_existing_game text;
  v_bad text;
  v_sum integer;
BEGIN
  IF p_job_id IS NULL OR p_game IS NULL OR p_stats IS NULL THEN
    RAISE EXCEPTION 'commit_box_score: job, game and stats are required';
  END IF;

  SELECT status INTO v_status FROM public.processing_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'commit_box_score: processing job % not found', p_job_id;
  END IF;

  -- Duplicate / repeated request: nothing to do, report the game committed by this job.
  IF v_status = 'committed' THEN
    SELECT game_id INTO v_existing_game FROM public.game_details WHERE source_job_id = p_job_id LIMIT 1;
    IF v_existing_game IS NULL THEN
      RAISE EXCEPTION 'commit_box_score: job % is already committed but no game references it', p_job_id;
    END IF;
    RETURN jsonb_build_object('game_id', v_existing_game, 'already_committed', true);
  END IF;
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'commit_box_score: job % must be approved before commit (current: %)', p_job_id, v_status;
  END IF;

  v_game_id := p_game->>'game_id';
  v_home := p_game->>'home_team_id';
  v_away := p_game->>'away_team_id';
  v_season := p_game->>'season';
  v_home_score := (p_game->>'home_score')::integer;
  v_away_score := (p_game->>'away_score')::integer;

  IF v_game_id IS NULL OR v_home IS NULL OR v_away IS NULL OR v_home = v_away THEN
    RAISE EXCEPTION 'commit_box_score: game id and two different teams are required';
  END IF;
  IF v_season IS NULL OR v_home_score IS NULL OR v_away_score IS NULL THEN
    RAISE EXCEPTION 'commit_box_score: season and both final scores are required for %', v_game_id;
  END IF;
  IF p_game->>'tipoff' IS NULL THEN
    RAISE EXCEPTION 'commit_box_score: tipoff (match date) is required for %', v_game_id;
  END IF;
  IF p_details IS NULL OR p_details->>'game_id' IS DISTINCT FROM v_game_id THEN
    RAISE EXCEPTION 'commit_box_score: game_details must belong to game %', v_game_id;
  END IF;
  IF jsonb_typeof(p_stats) <> 'array' OR jsonb_array_length(p_stats) = 0 THEN
    RAISE EXCEPTION 'commit_box_score: refusing to replace player stats of % with zero rows', v_game_id;
  END IF;

  -- Team-summary rows are validated whether or not the optional table exists, so a bad team code is
  -- never silently dropped.
  IF p_team_summary IS NOT NULL THEN
    IF jsonb_typeof(p_team_summary) <> 'array' THEN
      RAISE EXCEPTION 'commit_box_score: team summary must be an array (game %)', v_game_id;
    END IF;
    SELECT COALESCE(t.team_id, '<missing>') INTO v_bad
    FROM jsonb_to_recordset(p_team_summary) AS t(team_id text)
    WHERE t.team_id IS NULL OR t.team_id NOT IN (v_home, v_away)
    LIMIT 1;
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'commit_box_score: team summary row has team code % which is not a participant of % (% vs %). Fix the team code in the extraction.', v_bad, v_game_id, v_home, v_away;
    END IF;
    SELECT t.team_id INTO v_bad
    FROM jsonb_to_recordset(p_team_summary) AS t(team_id text)
    GROUP BY t.team_id HAVING count(*) > 1 LIMIT 1;
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'commit_box_score: team summary lists team % more than once for %', v_bad, v_game_id;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('commit_box_score:' || v_game_id));

  v_count := jsonb_array_length(p_stats);
  IF p_expected_players IS NOT NULL AND p_expected_players <> v_count THEN
    RAISE EXCEPTION 'commit_box_score: expected % player rows but received % for %', p_expected_players, v_count, v_game_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_stats) AS r(game_id text, player_id text, team_id text, points integer)
    WHERE r.game_id IS DISTINCT FROM v_game_id
       OR r.player_id IS NULL
       OR r.points IS NULL
       OR r.team_id IS NULL OR r.team_id NOT IN (v_home, v_away)
  ) THEN
    RAISE EXCEPTION 'commit_box_score: every stat row needs game %, a player_id, points and a team of this game', v_game_id;
  END IF;

  SELECT r.player_id INTO v_bad
  FROM jsonb_to_recordset(p_stats) AS r(player_id text)
  GROUP BY r.player_id HAVING count(*) > 1 LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'commit_box_score: player % appears more than once in %', v_bad, v_game_id;
  END IF;

  SELECT r.player_id INTO v_bad
  FROM jsonb_to_recordset(p_stats) AS r(player_id text, team_id text)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.player_seasons ps
    WHERE ps.player_id = r.player_id AND ps.season = v_season AND ps.team_id = r.team_id AND ps.is_active
  ) LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'commit_box_score: player % has no active % roster registration for the team in %', v_bad, v_season, v_game_id;
  END IF;

  SELECT COALESCE(sum(r.points), 0) INTO v_sum FROM jsonb_to_recordset(p_stats) AS r(team_id text, points integer) WHERE r.team_id = v_home;
  IF v_sum <> v_home_score THEN
    RAISE EXCEPTION 'commit_box_score: % player points sum to % but the final score is % in %', v_home, v_sum, v_home_score, v_game_id;
  END IF;
  SELECT COALESCE(sum(r.points), 0) INTO v_sum FROM jsonb_to_recordset(p_stats) AS r(team_id text, points integer) WHERE r.team_id = v_away;
  IF v_sum <> v_away_score THEN
    RAISE EXCEPTION 'commit_box_score: % player points sum to % but the final score is % in %', v_away, v_sum, v_away_score, v_game_id;
  END IF;

  -- 1. games
  INSERT INTO public.games (game_id, tipoff, season, venue, home_team_id, away_team_id, home_score, away_score)
  SELECT g.game_id, g.tipoff, g.season, g.venue, g.home_team_id, g.away_team_id, g.home_score, g.away_score
  FROM jsonb_populate_record(NULL::public.games, p_game) AS g
  ON CONFLICT (game_id) DO UPDATE SET
    tipoff = EXCLUDED.tipoff, season = EXCLUDED.season, venue = EXCLUDED.venue,
    home_team_id = EXCLUDED.home_team_id, away_team_id = EXCLUDED.away_team_id,
    home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score;

  -- 2. game_details
  INSERT INTO public.game_details (game_id, game_number, duration_minutes, crew_chief, umpires, score_intervals, source_job_id)
  SELECT d.game_id, d.game_number, d.duration_minutes, d.crew_chief, d.umpires, d.score_intervals, p_job_id
  FROM jsonb_populate_record(NULL::public.game_details, p_details) AS d
  ON CONFLICT (game_id) DO UPDATE SET
    game_number = EXCLUDED.game_number, duration_minutes = EXCLUDED.duration_minutes,
    crew_chief = EXCLUDED.crew_chief, umpires = EXCLUDED.umpires,
    score_intervals = EXCLUDED.score_intervals, source_job_id = EXCLUDED.source_job_id;

  -- 3. player_game_stats: replaced in this same transaction; a failing insert undoes the delete.
  DELETE FROM public.player_game_stats WHERE game_id = v_game_id;
  INSERT INTO public.player_game_stats (
    game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes,
    fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att,
    reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks,
    fouls_personal, fouls_drawn, plus_minus, efficiency, points
  )
  SELECT
    s.game_id, p_job_id, s.player_id, s.team_id, s.is_starter, s.is_captain, s.dnp, s.minutes,
    s.fg_made, s.fg_att, s.two_made, s.two_att, s.three_made, s.three_att, s.ft_made, s.ft_att,
    s.reb_off, s.reb_def, s.reb_tot, s.assists, s.turnovers, s.steals, s.blocks,
    s.fouls_personal, s.fouls_drawn, s.plus_minus, s.efficiency, s.points
  FROM jsonb_populate_recordset(NULL::public.player_game_stats, p_stats) AS s;

  -- 4. game_team_summary is OPTIONAL: written only if the table exists (it is not created here).
  -- The table is referenced only inside this guarded branch, so the function is valid and runs
  -- without it. Rows were already validated above.
  IF p_team_summary IS NOT NULL AND jsonb_typeof(p_team_summary) = 'array' AND jsonb_array_length(p_team_summary) > 0
     AND to_regclass('public.game_team_summary') IS NOT NULL THEN
    INSERT INTO public.game_team_summary (
      game_id, source_job_id, team_id, points_from_turnovers, points_in_paint, points_in_paint_att,
      points_in_paint_pct, second_chance_points, fast_break_points, bench_points, biggest_lead,
      biggest_lead_score, biggest_scoring_run, biggest_scoring_run_score, lead_changes, times_tied, time_with_lead
    )
    SELECT
      v_game_id, p_job_id, t.team_id, t.points_from_turnovers, t.points_in_paint, t.points_in_paint_att,
      t.points_in_paint_pct, t.second_chance_points, t.fast_break_points, t.bench_points, t.biggest_lead,
      t.biggest_lead_score, t.biggest_scoring_run, t.biggest_scoring_run_score, t.lead_changes, t.times_tied, t.time_with_lead
    FROM jsonb_populate_recordset(NULL::public.game_team_summary, p_team_summary) AS t
    ON CONFLICT (game_id, team_id) DO UPDATE SET
      source_job_id = EXCLUDED.source_job_id,
      points_from_turnovers = EXCLUDED.points_from_turnovers, points_in_paint = EXCLUDED.points_in_paint,
      points_in_paint_att = EXCLUDED.points_in_paint_att, points_in_paint_pct = EXCLUDED.points_in_paint_pct,
      second_chance_points = EXCLUDED.second_chance_points, fast_break_points = EXCLUDED.fast_break_points,
      bench_points = EXCLUDED.bench_points, biggest_lead = EXCLUDED.biggest_lead,
      biggest_lead_score = EXCLUDED.biggest_lead_score, biggest_scoring_run = EXCLUDED.biggest_scoring_run,
      biggest_scoring_run_score = EXCLUDED.biggest_scoring_run_score, lead_changes = EXCLUDED.lead_changes,
      times_tied = EXCLUDED.times_tied, time_with_lead = EXCLUDED.time_with_lead;
  END IF;

  -- 5. job status, last so "committed" is only ever visible together with all the data
  UPDATE public.processing_jobs
  SET status = 'committed', committed_at = now(), error_message = NULL, updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('game_id', v_game_id, 'already_committed', false, 'player_rows', v_count);
END;
$$;

-- Only the server (service role, used after requireAdmin) may call it.
REVOKE ALL ON FUNCTION public.commit_box_score(uuid, jsonb, jsonb, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_box_score(uuid, jsonb, jsonb, jsonb, jsonb, integer) TO service_role;

-- ROLLBACK (code must be rolled back first, it requires this function):
--   DROP FUNCTION IF EXISTS public.commit_box_score(uuid, jsonb, jsonb, jsonb, jsonb, integer);
-- CLEANUP of the superseded helper if it was ever applied (it is no longer used):
--   DROP FUNCTION IF EXISTS public.replace_game_player_stats(text, jsonb);
