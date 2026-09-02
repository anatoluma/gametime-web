-- LBM 2026/27 first-round schedule.
-- Run in Supabase SQL Editor after confirming the 14 team IDs exist.
-- The source supplies dates but no tip-off times. Because games.tipoff is
-- required, the import uses 12:00 Europe/Chisinau as a date-only placeholder.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS round_number INTEGER;

CREATE INDEX IF NOT EXISTS games_season_schedule_date_idx
  ON public.games (season, scheduled_date, round_number);

INSERT INTO public.seasons (season, is_current)
VALUES ('2026/27', false)
ON CONFLICT (season) DO NOTHING;

-- CAS2 was introduced by an earlier version of this script. The existing
-- Casa Noastra 2 franchise uses CN2, so move any imported fixtures first.
UPDATE public.games AS old_game
SET game_id = replace(old_game.game_id, '_CAS2', '_CN2')
WHERE old_game.season = '2026/27'
  AND old_game.game_id LIKE '%_CAS2%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.games AS existing_game
    WHERE existing_game.game_id = replace(old_game.game_id, '_CAS2', '_CN2')
  );

UPDATE public.games
SET home_team_id = 'CN2'
WHERE season = '2026/27' AND home_team_id = 'CAS2';

UPDATE public.games
SET away_team_id = 'CN2'
WHERE season = '2026/27' AND away_team_id = 'CAS2';

DELETE FROM public.team_seasons
WHERE season = '2026/27' AND team_id = 'CAS2';

INSERT INTO public.teams (team_id, team_name, city, is_active)
VALUES
  ('COM', 'COMRAT', 'Comrat', true),
  ('STR', 'STRASENI', 'Straseni', true)
ON CONFLICT (team_id) DO UPDATE SET
  team_name = EXCLUDED.team_name,
  city = EXCLUDED.city,
  is_active = EXCLUDED.is_active;

INSERT INTO public.team_seasons (team_id, season, is_active)
SELECT team_id, '2026/27', true
FROM (VALUES
  ('ADM'), ('AMB'), ('BLD'), ('CAS'), ('CN2'), ('COM'), ('DRO'),
  ('EDI'), ('GTM'), ('HAI'), ('MET'), ('STR'), ('USM'), ('WOL')
) AS teams(team_id)
ON CONFLICT (team_id, season) DO UPDATE SET is_active = EXCLUDED.is_active;

WITH fixtures(round_number, scheduled_date, home_team_id, away_team_id, venue) AS (
  VALUES
    (1,  '2026-09-12'::date, 'MET',  'COM',  'Ribnita'),
    (1,  '2026-09-12'::date, 'HAI',  'ADM',  'Blijnii Hutor'),
    (1,  '2026-09-13'::date, 'CAS',  'STR',  'Chisinau'),
    (1,  '2026-09-13'::date, 'AMB',  'CN2',  'Chisinau'),
    (1,  '2026-09-13'::date, 'GTM',  'BLD',  'Chisinau'),
    (1,  '2026-09-13'::date, 'USM',  'WOL',  'Chisinau'),
    (1,  '2026-09-13'::date, 'EDI',  'DRO',  'Edinet'),

    (2,  '2026-09-19'::date, 'HAI',  'EDI',  'Blijnii Hutor'),
    (2,  '2026-09-19'::date, 'DRO',  'BLD',  'Drochia'),
    (2,  '2026-09-20'::date, 'WOL',  'GTM',  'Chisinau'),
    (2,  '2026-09-20'::date, 'ADM',  'AMB',  'Chisinau'),
    (2,  '2026-09-20'::date, 'USM',  'COM',  'Chisinau'),
    (2,  '2026-09-20'::date, 'CN2',  'CAS',  'Chisinau'),
    (2,  '2026-09-20'::date, 'STR',  'MET',  'Chisinau'),

    (3,  '2026-09-26'::date, 'MET',  'CN2',  'Ribnita'),
    (3,  '2026-09-26'::date, 'DRO',  'WOL',  'Drochia'),
    (3,  '2026-09-27'::date, 'COM',  'STR',  'Comrat'),
    (3,  '2026-09-27'::date, 'BLD',  'HAI',  'Chisinau'),
    (3,  '2026-09-27'::date, 'AMB',  'EDI',  'Chisinau'),
    (3,  '2026-09-27'::date, 'GTM',  'USM',  'Chisinau'),
    (3,  '2026-09-27'::date, 'CAS',  'ADM',  'Chisinau'),

    (4,  '2026-10-03'::date, 'MET',  'ADM',  'Ribnita'),
    (4,  '2026-10-03'::date, 'HAI',  'WOL',  'Blijnii Hutor'),
    (4,  '2026-10-04'::date, 'USM',  'DRO',  'Chisinau'),
    (4,  '2026-10-04'::date, 'CN2',  'STR',  'Chisinau'),
    (4,  '2026-10-04'::date, 'BLD',  'AMB',  'Chisinau'),
    (4,  '2026-10-04'::date, 'GTM',  'COM',  'Chisinau'),
    (4,  '2026-10-04'::date, 'EDI',  'CAS',  'Edinet'),

    (5,  '2026-10-10'::date, 'COM',  'CN2',  'Comrat'),
    (5,  '2026-10-10'::date, 'HAI',  'USM',  'Blijnii Hutor'),
    (5,  '2026-10-10'::date, 'MET',  'EDI',  'Ribnita'),
    (5,  '2026-10-11'::date, 'STR',  'ADM',  'Chisinau'),
    (5,  '2026-10-11'::date, 'CAS',  'BLD',  'Chisinau'),
    (5,  '2026-10-11'::date, 'AMB',  'WOL',  'Chisinau'),
    (5,  '2026-10-11'::date, 'GTM',  'DRO',  'Chisinau'),

    (6,  '2026-10-17'::date, 'DRO',  'COM',  'Drochia'),
    (6,  '2026-10-18'::date, 'GTM',  'HAI',  'Chisinau'),
    (6,  '2026-10-18'::date, 'USM',  'AMB',  'Chisinau'),
    (6,  '2026-10-18'::date, 'BLD',  'MET',  'Chisinau'),
    (6,  '2026-10-18'::date, 'WOL',  'CAS',  'Chisinau'),
    (6,  '2026-10-18'::date, 'EDI',  'STR',  'Edinet'),
    (6,  '2026-10-18'::date, 'ADM',  'CN2',  'Chisinau'),

    (7,  '2026-10-24'::date, 'MET',  'WOL',  'Ribnita'),
    (7,  '2026-10-24'::date, 'HAI',  'DRO',  'Blijnii Hutor'),
    (7,  '2026-10-24'::date, 'COM',  'ADM',  'Comrat'),
    (7,  '2026-10-25'::date, 'CN2',  'EDI',  'Chisinau'),
    (7,  '2026-10-25'::date, 'AMB',  'GTM',  'Chisinau'),
    (7,  '2026-10-25'::date, 'STR',  'BLD',  'Chisinau'),
    (7,  '2026-10-25'::date, 'CAS',  'USM',  'Chisinau'),

    (8,  '2026-10-31'::date, 'HAI',  'COM',  'Blijnii Hutor'),
    (8,  '2026-10-31'::date, 'DRO',  'AMB',  'Drochia'),
    (8,  '2026-11-01'::date, 'GTM',  'CAS',  'Chisinau'),
    (8,  '2026-11-01'::date, 'USM',  'MET',  'Chisinau'),
    (8,  '2026-11-01'::date, 'WOL',  'STR',  'Chisinau'),
    (8,  '2026-11-01'::date, 'BLD',  'CN2',  'Chisinau'),
    (8,  '2026-11-01'::date, 'EDI',  'ADM',  'Edinet'),

    (9,  '2026-11-07'::date, 'COM',  'EDI',  'Comrat'),
    (9,  '2026-11-07'::date, 'MET',  'GTM',  'Ribnita'),
    (9,  '2026-11-08'::date, 'ADM',  'BLD',  'Chisinau'),
    (9,  '2026-11-08'::date, 'CN2',  'WOL',  'Chisinau'),
    (9,  '2026-11-08'::date, 'STR',  'USM',  'Chisinau'),
    (9,  '2026-11-08'::date, 'CAS',  'DRO',  'Chisinau'),
    (9,  '2026-11-08'::date, 'AMB',  'HAI',  'Chisinau'),

    (10, '2026-11-14'::date, 'DRO',  'MET',  'Drochia'),
    (10, '2026-11-14'::date, 'HAI',  'CAS',  'Blijnii Hutor'),
    (10, '2026-11-15'::date, 'GTM',  'STR',  'Chisinau'),
    (10, '2026-11-15'::date, 'USM',  'CN2',  'Chisinau'),
    (10, '2026-11-15'::date, 'WOL',  'ADM',  'Chisinau'),
    (10, '2026-11-15'::date, 'BLD',  'EDI',  'Chisinau'),
    (10, '2026-11-15'::date, 'AMB',  'COM',  'Chisinau'),

    (11, '2026-11-21'::date, 'COM',  'BLD',  'Comrat'),
    (11, '2026-11-21'::date, 'MET',  'HAI',  'Ribnita'),
    (11, '2026-11-22'::date, 'CN2',  'GTM',  'Chisinau'),
    (11, '2026-11-22'::date, 'ADM',  'USM',  'Chisinau'),
    (11, '2026-11-22'::date, 'CAS',  'AMB',  'Chisinau'),
    (11, '2026-11-22'::date, 'EDI',  'WOL',  'Edinet'),
    (11, '2026-11-22'::date, 'STR',  'DRO',  'Chisinau'),

    (12, '2026-11-28'::date, 'HAI',  'STR',  'Blijnii Hutor'),
    (12, '2026-11-28'::date, 'DRO',  'CN2',  'Drochia'),
    (12, '2026-11-29'::date, 'CAS',  'COM',  'Chisinau'),
    (12, '2026-11-29'::date, 'AMB',  'MET',  'Chisinau'),
    (12, '2026-11-29'::date, 'GTM',  'ADM',  'Chisinau'),
    (12, '2026-11-29'::date, 'USM',  'EDI',  'Chisinau'),
    (12, '2026-11-29'::date, 'WOL',  'BLD',  'Chisinau'),

    (13, '2026-12-05'::date, 'COM',  'WOL',  'Comrat'),
    (13, '2026-12-05'::date, 'MET',  'CAS',  'Ribnita'),
    (13, '2026-12-06'::date, 'BLD',  'USM',  'Chisinau'),
    (13, '2026-12-06'::date, 'EDI',  'GTM',  'Edinet'),
    (13, '2026-12-06'::date, 'ADM',  'DRO',  'Chisinau'),
    (13, '2026-12-06'::date, 'STR',  'AMB',  'Chisinau'),
    (13, '2026-12-06'::date, 'CN2',  'HAI',  'Chisinau')
)
INSERT INTO public.games (
  game_id, season, scheduled_date, round_number, tipoff, venue,
  home_team_id, away_team_id, home_score, away_score
)
SELECT
  'g_' || replace(scheduled_date::text, '-', '_') || '_' || home_team_id || '_' || away_team_id,
  '2026/27', scheduled_date, round_number,
  (scheduled_date::timestamp + time '12:00') AT TIME ZONE 'Europe/Chisinau', venue,
  home_team_id, away_team_id, NULL, NULL
FROM fixtures
ON CONFLICT (game_id) DO UPDATE SET
  season = EXCLUDED.season,
  scheduled_date = EXCLUDED.scheduled_date,
  round_number = EXCLUDED.round_number,
  venue = EXCLUDED.venue,
  home_team_id = EXCLUDED.home_team_id,
  away_team_id = EXCLUDED.away_team_id;

-- Verification queries: both should return 91.
SELECT COUNT(*) AS imported_games
FROM public.games
WHERE season = '2026/27' AND round_number BETWEEN 1 AND 13;

SELECT round_number, COUNT(*) AS games_in_round
FROM public.games
WHERE season = '2026/27' AND round_number BETWEEN 1 AND 13
GROUP BY round_number
ORDER BY round_number;
