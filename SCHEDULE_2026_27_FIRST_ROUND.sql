-- LBM 2026/27 first-round schedule.
-- Run in Supabase SQL Editor after confirming the 14 team IDs exist.
-- The source supplies dates but no tip-off times, so tipoff remains NULL.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS round_number INTEGER;

CREATE INDEX IF NOT EXISTS games_season_schedule_date_idx
  ON public.games (season, scheduled_date, round_number);

INSERT INTO public.seasons (season, is_current)
VALUES ('2026/27', false)
ON CONFLICT (season) DO NOTHING;

INSERT INTO public.teams (team_id, team_name, city, is_active)
VALUES
  ('COM', 'COMRAT', 'Comrat', true),
  ('STR', 'STRASENI', 'Straseni', true),
  ('CAS2', 'CASA NOASTRA 2', 'Chisinau', true)
ON CONFLICT (team_id) DO UPDATE SET
  team_name = EXCLUDED.team_name,
  city = EXCLUDED.city,
  is_active = EXCLUDED.is_active;

INSERT INTO public.team_seasons (team_id, season, is_active)
SELECT team_id, '2026/27', true
FROM (VALUES
  ('ADM'), ('AMB'), ('BLD'), ('CAS'), ('CAS2'), ('COM'), ('DRO'),
  ('EDI'), ('GTM'), ('HAI'), ('MET'), ('STR'), ('USM'), ('WOL')
) AS teams(team_id)
ON CONFLICT (team_id, season) DO UPDATE SET is_active = EXCLUDED.is_active;

WITH fixtures(round_number, scheduled_date, home_team_id, away_team_id, venue) AS (
  VALUES
    (1,  '2026-09-12'::date, 'MET',  'COM',  'Рыбница'),
    (1,  '2026-09-12'::date, 'HAI',  'ADM',  'Ближний Хутор'),
    (1,  '2026-09-13'::date, 'CAS',  'STR',  'Кишинев'),
    (1,  '2026-09-13'::date, 'AMB',  'CAS2', 'Кишинев'),
    (1,  '2026-09-13'::date, 'GTM',  'BLD',  'Кишинев'),
    (1,  '2026-09-13'::date, 'USM',  'WOL',  'Кишинев'),
    (1,  '2026-09-13'::date, 'EDI',  'DRO',  'Единцы'),

    (2,  '2026-09-19'::date, 'HAI',  'EDI',  'Ближний Хутор'),
    (2,  '2026-09-19'::date, 'DRO',  'BLD',  'Дрокия'),
    (2,  '2026-09-20'::date, 'WOL',  'GTM',  'Кишинев'),
    (2,  '2026-09-20'::date, 'ADM',  'AMB',  'Кишинев'),
    (2,  '2026-09-20'::date, 'USM',  'COM',  'Кишинев'),
    (2,  '2026-09-20'::date, 'CAS2', 'CAS',  'Кишинев'),
    (2,  '2026-09-20'::date, 'STR',  'MET',  'Кишинев'),

    (3,  '2026-09-26'::date, 'MET',  'CAS2', 'Рыбница'),
    (3,  '2026-09-26'::date, 'DRO',  'WOL',  'Дрокия'),
    (3,  '2026-09-27'::date, 'COM',  'STR',  'Комрат'),
    (3,  '2026-09-27'::date, 'BLD',  'HAI',  'Кишинев'),
    (3,  '2026-09-27'::date, 'AMB',  'EDI',  'Кишинев'),
    (3,  '2026-09-27'::date, 'GTM',  'USM',  'Кишинев'),
    (3,  '2026-09-27'::date, 'CAS',  'ADM',  'Кишинев'),

    (4,  '2026-10-03'::date, 'MET',  'ADM',  'Рыбница'),
    (4,  '2026-10-03'::date, 'HAI',  'WOL',  'Ближний Хутор'),
    (4,  '2026-10-04'::date, 'USM',  'DRO',  'Кишинев'),
    (4,  '2026-10-04'::date, 'CAS2', 'STR',  'Кишинев'),
    (4,  '2026-10-04'::date, 'BLD',  'AMB',  'Кишинев'),
    (4,  '2026-10-04'::date, 'GTM',  'COM',  'Кишинев'),
    (4,  '2026-10-04'::date, 'EDI',  'CAS',  'Единцы'),

    (5,  '2026-10-10'::date, 'COM',  'CAS2', 'Комрат'),
    (5,  '2026-10-10'::date, 'HAI',  'USM',  'Ближний Хутор'),
    (5,  '2026-10-10'::date, 'MET',  'EDI',  'Рыбница'),
    (5,  '2026-10-11'::date, 'STR',  'ADM',  'Кишинев'),
    (5,  '2026-10-11'::date, 'CAS',  'BLD',  'Кишинев'),
    (5,  '2026-10-11'::date, 'AMB',  'WOL',  'Кишинев'),
    (5,  '2026-10-11'::date, 'GTM',  'DRO',  'Кишинев'),

    (6,  '2026-10-17'::date, 'DRO',  'COM',  'Дрокия'),
    (6,  '2026-10-18'::date, 'GTM',  'HAI',  'Кишинев'),
    (6,  '2026-10-18'::date, 'USM',  'AMB',  'Кишинев'),
    (6,  '2026-10-18'::date, 'BLD',  'MET',  'Кишинев'),
    (6,  '2026-10-18'::date, 'WOL',  'CAS',  'Кишинев'),
    (6,  '2026-10-18'::date, 'EDI',  'STR',  'Единцы'),
    (6,  '2026-10-18'::date, 'ADM',  'CAS2', 'Кишинев'),

    (7,  '2026-10-24'::date, 'MET',  'WOL',  'Рыбница'),
    (7,  '2026-10-24'::date, 'HAI',  'DRO',  'Ближний Хутор'),
    (7,  '2026-10-24'::date, 'COM',  'ADM',  'Комрат'),
    (7,  '2026-10-25'::date, 'CAS2', 'EDI',  'Кишинев'),
    (7,  '2026-10-25'::date, 'AMB',  'GTM',  'Кишинев'),
    (7,  '2026-10-25'::date, 'STR',  'BLD',  'Кишинев'),
    (7,  '2026-10-25'::date, 'CAS',  'USM',  'Кишинев'),

    (8,  '2026-10-31'::date, 'HAI',  'COM',  'Ближний Хутор'),
    (8,  '2026-10-31'::date, 'DRO',  'AMB',  'Дрокия'),
    (8,  '2026-11-01'::date, 'GTM',  'CAS',  'Кишинев'),
    (8,  '2026-11-01'::date, 'USM',  'MET',  'Кишинев'),
    (8,  '2026-11-01'::date, 'WOL',  'STR',  'Кишинев'),
    (8,  '2026-11-01'::date, 'BLD',  'CAS2', 'Кишинев'),
    (8,  '2026-11-01'::date, 'EDI',  'ADM',  'Единцы'),

    (9,  '2026-11-07'::date, 'COM',  'EDI',  'Комрат'),
    (9,  '2026-11-07'::date, 'MET',  'GTM',  'Рыбница'),
    (9,  '2026-11-08'::date, 'ADM',  'BLD',  'Кишинев'),
    (9,  '2026-11-08'::date, 'CAS2', 'WOL',  'Кишинев'),
    (9,  '2026-11-08'::date, 'STR',  'USM',  'Кишинев'),
    (9,  '2026-11-08'::date, 'CAS',  'DRO',  'Кишинев'),
    (9,  '2026-11-08'::date, 'AMB',  'HAI',  'Кишинев'),

    (10, '2026-11-14'::date, 'DRO',  'MET',  'Дрокия'),
    (10, '2026-11-14'::date, 'HAI',  'CAS',  'Ближний Хутор'),
    (10, '2026-11-15'::date, 'GTM',  'STR',  'Кишинев'),
    (10, '2026-11-15'::date, 'USM',  'CAS2', 'Кишинев'),
    (10, '2026-11-15'::date, 'WOL',  'ADM',  'Кишинев'),
    (10, '2026-11-15'::date, 'BLD',  'EDI',  'Кишинев'),
    (10, '2026-11-15'::date, 'AMB',  'COM',  'Кишинев'),

    (11, '2026-11-21'::date, 'COM',  'BLD',  'Комрат'),
    (11, '2026-11-21'::date, 'MET',  'HAI',  'Рыбница'),
    (11, '2026-11-22'::date, 'CAS2', 'GTM',  'Кишинев'),
    (11, '2026-11-22'::date, 'ADM',  'USM',  'Кишинев'),
    (11, '2026-11-22'::date, 'CAS',  'AMB',  'Кишинев'),
    (11, '2026-11-22'::date, 'EDI',  'WOL',  'Единцы'),
    (11, '2026-11-22'::date, 'STR',  'DRO',  'Кишинев'),

    (12, '2026-11-28'::date, 'HAI',  'STR',  'Ближний Хутор'),
    (12, '2026-11-28'::date, 'DRO',  'CAS2', 'Дрокия'),
    (12, '2026-11-29'::date, 'CAS',  'COM',  'Кишинев'),
    (12, '2026-11-29'::date, 'AMB',  'MET',  'Кишинев'),
    (12, '2026-11-29'::date, 'GTM',  'ADM',  'Кишинев'),
    (12, '2026-11-29'::date, 'USM',  'EDI',  'Кишинев'),
    (12, '2026-11-29'::date, 'WOL',  'BLD',  'Кишинев'),

    (13, '2026-12-05'::date, 'COM',  'WOL',  'Комрат'),
    (13, '2026-12-05'::date, 'MET',  'CAS',  'Рыбница'),
    (13, '2026-12-06'::date, 'BLD',  'USM',  'Кишинев'),
    (13, '2026-12-06'::date, 'EDI',  'GTM',  'Единцы'),
    (13, '2026-12-06'::date, 'ADM',  'DRO',  'Кишинев'),
    (13, '2026-12-06'::date, 'STR',  'AMB',  'Кишинев'),
    (13, '2026-12-06'::date, 'CAS2', 'HAI',  'Кишинев')
)
INSERT INTO public.games (
  game_id, season, scheduled_date, round_number, tipoff, venue,
  home_team_id, away_team_id, home_score, away_score
)
SELECT
  'g_' || replace(scheduled_date::text, '-', '_') || '_' || home_team_id || '_' || away_team_id,
  '2026/27', scheduled_date, round_number, NULL, venue,
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
