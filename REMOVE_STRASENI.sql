-- Remove the withdrawn Straseni team and its unplayed fixtures.
-- Apply manually in the Supabase SQL Editor.

DELETE FROM public.games
WHERE home_team_id = 'STR' OR away_team_id = 'STR';

DELETE FROM public.team_seasons
WHERE team_id = 'STR';

DELETE FROM public.teams
WHERE team_id = 'STR';