-- Apply in Supabase before using the "reassign jersey" option in manual game entry.
-- The old registration is only changed if the new player and registration are inserted.
CREATE OR REPLACE FUNCTION public.create_manual_player_reassign_jersey(
  p_player_id text, p_team_id text, p_season text, p_first_name text,
  p_last_name text, p_jersey_number integer, p_existing_player_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_player jsonb;
BEGIN
  IF p_player_id IS NULL OR p_team_id IS NULL OR p_season IS NULL
     OR p_first_name IS NULL OR p_last_name IS NULL OR p_jersey_number IS NULL
     OR p_jersey_number < 0 OR p_jersey_number > 32767 OR p_existing_player_id IS NULL THEN
    RAISE EXCEPTION 'Invalid player or jersey reassignment';
  END IF;

  UPDATE public.player_seasons SET jersey_number = NULL
  WHERE player_id = p_existing_player_id AND team_id = p_team_id
    AND season = p_season AND is_active = true AND jersey_number = p_jersey_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The jersey assignment changed. Refresh and check the conflict again.';
  END IF;

  UPDATE public.players SET jersey_number = NULL
  WHERE player_id = p_existing_player_id AND team_id = p_team_id AND jersey_number = p_jersey_number;

  INSERT INTO public.players (player_id, team_id, first_name, last_name, jersey_number)
  VALUES (p_player_id, p_team_id, p_first_name, p_last_name, p_jersey_number)
  RETURNING jsonb_build_object('player_id', player_id, 'team_id', team_id,
    'first_name', first_name, 'last_name', last_name, 'jersey_number', jersey_number) INTO v_player;
  INSERT INTO public.player_seasons (player_id, season, team_id, jersey_number, is_active)
  VALUES (p_player_id, p_season, p_team_id, p_jersey_number, true);
  RETURN v_player;
END;
$$;
REVOKE ALL ON FUNCTION public.create_manual_player_reassign_jersey(text, text, text, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_manual_player_reassign_jersey(text, text, text, text, text, integer, text) TO service_role;
