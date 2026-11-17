-- Requires GAME_DATA_PROVENANCE.sql and the box-score schema. Apply before deploying the API.
-- Serializes manual writes with commit_box_score and commits game + player stats atomically.
CREATE OR REPLACE FUNCTION public.save_manual_game(p_game jsonb, p_stats jsonb, p_edit boolean)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_game_id text := p_game->>'game_id';
  v_game public.games%ROWTYPE;
  v_input public.games%ROWTYPE;
  v_created boolean := false;
  v_scheduled boolean;
BEGIN
  IF v_game_id IS NULL OR v_game_id = '' OR p_edit IS NULL
     OR p_stats IS NULL OR jsonb_typeof(p_stats) <> 'array' THEN
    RAISE EXCEPTION 'save_manual_game: game id, edit mode and stats array are required';
  END IF;
  IF NOT p_edit AND (p_game->>'home_score' IS NULL OR p_game->>'away_score' IS NULL) THEN
    RAISE EXCEPTION 'save_manual_game: both scores are required for a new game';
  END IF;

  -- The box-score RPC takes the same lock before touching the game or its stats.
  PERFORM pg_advisory_xact_lock(hashtext('commit_box_score:' || v_game_id));
  SELECT * INTO v_game FROM public.games WHERE game_id = v_game_id FOR UPDATE;

  IF NOT FOUND THEN
    IF p_edit THEN
      RETURN jsonb_build_object('status', 'not_found');
    END IF;
    SELECT * INTO v_input FROM jsonb_populate_record(NULL::public.games, p_game);
    INSERT INTO public.games (game_id, tipoff, season, venue, home_team_id, away_team_id, home_score, away_score, data_source, source_job_id)
    VALUES (v_game_id, v_input.tipoff, v_input.season, v_input.venue, v_input.home_team_id, v_input.away_team_id, v_input.home_score, v_input.away_score, 'manual', NULL)
    ON CONFLICT (game_id) DO NOTHING
    RETURNING * INTO v_game;
    IF NOT FOUND THEN
      -- A non-cooperating writer inserted this ID while we held the advisory lock.
      SELECT * INTO v_game FROM public.games WHERE game_id = v_game_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'save_manual_game: game % changed concurrently; retry', v_game_id;
      END IF;
    ELSE
      v_created := true;
    END IF;
  END IF;

  IF NOT v_created THEN
    v_scheduled := v_game.home_score IS NULL AND v_game.away_score IS NULL
      AND v_game.data_source = 'unknown' AND v_game.source_job_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = v_game_id)
      AND NOT EXISTS (SELECT 1 FROM public.game_details WHERE game_id = v_game_id AND source_job_id IS NOT NULL);
    IF NOT p_edit AND NOT v_scheduled THEN
      RETURN jsonb_build_object('status', 'conflict');
    END IF;

    -- Populate only submitted fields; editing must never reset provenance or schedule metadata.
    SELECT * INTO v_input FROM jsonb_populate_record(v_game, p_game - 'data_source' - 'source_job_id' - 'game_id');
    UPDATE public.games SET
      tipoff = v_input.tipoff, season = v_input.season, venue = v_input.venue,
      home_team_id = v_input.home_team_id, away_team_id = v_input.away_team_id,
      home_score = v_input.home_score, away_score = v_input.away_score,
      data_source = CASE
        WHEN v_scheduled AND v_input.home_score IS NOT NULL AND v_input.away_score IS NOT NULL THEN 'manual'
        ELSE v_game.data_source
      END
    WHERE game_id = v_game_id
    RETURNING * INTO v_game;
  END IF;

  IF p_edit THEN
    DELETE FROM public.player_game_stats old
    WHERE old.game_id = v_game_id
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_populate_recordset(NULL::public.player_game_stats, p_stats) s
        WHERE s.player_id = old.player_id
      );

    -- Update retained rows in place, so every column not owned by the manual form survives.
    UPDATE public.player_game_stats old SET
      team_id = s.team_id, points = s.points,
      is_starter = COALESCE(s.is_starter, old.is_starter),
      minutes = COALESCE(s.minutes, old.minutes),
      two_made = COALESCE(s.two_made, old.two_made), two_att = COALESCE(s.two_att, old.two_att),
      three_made = COALESCE(s.three_made, old.three_made), three_att = COALESCE(s.three_att, old.three_att),
      ft_made = COALESCE(s.ft_made, old.ft_made), ft_att = COALESCE(s.ft_att, old.ft_att),
      reb_off = COALESCE(s.reb_off, old.reb_off), reb_def = COALESCE(s.reb_def, old.reb_def),
      reb_tot = COALESCE(s.reb_tot, old.reb_tot), assists = COALESCE(s.assists, old.assists),
      turnovers = COALESCE(s.turnovers, old.turnovers), steals = COALESCE(s.steals, old.steals),
      blocks = COALESCE(s.blocks, old.blocks), fouls_personal = COALESCE(s.fouls_personal, old.fouls_personal),
      plus_minus = COALESCE(s.plus_minus, old.plus_minus), efficiency = COALESCE(s.efficiency, old.efficiency)
    FROM jsonb_populate_recordset(NULL::public.player_game_stats, p_stats) s
    WHERE old.game_id = v_game_id AND old.player_id = s.player_id;
  END IF;

  INSERT INTO public.player_game_stats (
    game_id, player_id, team_id, points, is_starter, minutes, two_made, two_att,
    three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists,
    turnovers, steals, blocks, fouls_personal, plus_minus, efficiency
  )
  SELECT v_game_id, s.player_id, s.team_id, s.points, s.is_starter, s.minutes,
    s.two_made, s.two_att, s.three_made, s.three_att, s.ft_made, s.ft_att,
    s.reb_off, s.reb_def, s.reb_tot, s.assists, s.turnovers, s.steals,
    s.blocks, s.fouls_personal, s.plus_minus, s.efficiency
  FROM jsonb_populate_recordset(NULL::public.player_game_stats, p_stats) s
  WHERE NOT p_edit OR NOT EXISTS (
    SELECT 1 FROM public.player_game_stats old
    WHERE old.game_id = v_game_id AND old.player_id = s.player_id
  );

  RETURN jsonb_build_object('status', 'ok', 'game', to_jsonb(v_game));
END;
$$;

REVOKE ALL ON FUNCTION public.save_manual_game(jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_manual_game(jsonb, jsonb, boolean) TO service_role;
