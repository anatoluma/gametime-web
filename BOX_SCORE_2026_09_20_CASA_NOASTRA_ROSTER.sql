-- ============================================================
-- Roster update from FIBA box score dated 2026-09-20:
--   CASA NOASTRA (CAS) vs CASA NOASTRA 2 (CN2)   [box-score codes "Caa" / "Cas"]
-- Applies to season 2026/27 only. 2025/26 CAS history/games/stats untouched.
-- Also removes the empty, unreferenced duplicate team row "CAS2"
-- (0 players/player_seasons/games referenced it — confirmed before deletion).
-- Run in Supabase SQL editor. Re-run is mostly idempotent (fixed player IDs;
-- ON CONFLICT DO NOTHING on inserts). Run once.
-- ============================================================

BEGIN;

-- ---- Remove empty duplicate team row (superseded by CN2) ----
DELETE FROM teams WHERE team_id = 'CAS2';

-- ---- Players migrating from historical CAS roster to Casa Noastra 2 (CN2) ----
-- Same player identity/history preserved; only the 2026/27 team+jersey changes.

-- Bolgari, M. — CAS #6 -> CN2 #5
UPDATE players SET team_id = 'CN2', jersey_number = 5 WHERE player_id = 'p0004';
UPDATE player_seasons SET team_id = 'CN2', jersey_number = 5 WHERE player_id = 'p0004' AND season = '2026/27';

-- Stanila, D. — CAS #3 -> CN2 #6
UPDATE players SET team_id = 'CN2', jersey_number = 6 WHERE player_id = 'p0002';
UPDATE player_seasons SET team_id = 'CN2', jersey_number = 6 WHERE player_id = 'p0002' AND season = '2026/27';

-- Andrianov, A. — CAS #7 -> CN2 #7 (team change only, number unchanged)
UPDATE players SET team_id = 'CN2', jersey_number = 7 WHERE player_id = 'p0005';
UPDATE player_seasons SET team_id = 'CN2', jersey_number = 7 WHERE player_id = 'p0005' AND season = '2026/27';

-- ---- Jersey-only corrections for players staying on Casa Noastra (CAS) ----

-- Priscepnii, V. — 4 -> 5
UPDATE players SET jersey_number = 5 WHERE player_id = 'p0003';
UPDATE player_seasons SET jersey_number = 5 WHERE player_id = 'p0003' AND season = '2026/27';

-- Bogatireov, A. — 25 -> 52
UPDATE players SET jersey_number = 52 WHERE player_id = 'p0009';
UPDATE player_seasons SET jersey_number = 52 WHERE player_id = 'p0009' AND season = '2026/27';

-- ---- Free jersey #12 on CAS for 2026/27 (Solopa not in this box score, keeps player record) ----
UPDATE players SET jersey_number = NULL WHERE player_id = 'p0195';
UPDATE player_seasons SET is_active = false WHERE player_id = 'p0195' AND season = '2026/27';

-- ---- New players: Casa Noastra 2 (CN2) ----
INSERT INTO players (player_id, team_id, first_name, last_name, jersey_number, photo_url) VALUES
  ('p0221', 'CN2', 'V', 'Arnaut',     1,  NULL),
  ('p0222', 'CN2', 'V', 'Martanov',   3,  NULL),
  ('p0223', 'CN2', 'O', 'Adamov',     15, NULL),
  ('p0224', 'CN2', 'V', 'Jeregi',     18, NULL),
  ('p0225', 'CN2', 'N', 'Lungu',      20, NULL),
  ('p0226', 'CN2', 'N', 'Morari',     25, NULL),
  ('p0227', 'CN2', 'A', 'Streapko',   45, NULL)
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO player_seasons (player_id, season, team_id, jersey_number, is_active) VALUES
  ('p0221', '2026/27', 'CN2', 1,  true),
  ('p0222', '2026/27', 'CN2', 3,  true),
  ('p0223', '2026/27', 'CN2', 15, true),
  ('p0224', '2026/27', 'CN2', 18, true),
  ('p0225', '2026/27', 'CN2', 20, true),
  ('p0226', '2026/27', 'CN2', 25, true),
  ('p0227', '2026/27', 'CN2', 45, true)
ON CONFLICT (player_id, season) DO NOTHING;

-- ---- New players: Casa Noastra (CAS) ----
INSERT INTO players (player_id, team_id, first_name, last_name, jersey_number, photo_url) VALUES
  ('p0228', 'CAS', 'D', 'Iarovoi',    0,  NULL),
  ('p0229', 'CAS', 'M', 'Ceban',      4,  NULL),
  ('p0230', 'CAS', 'K', 'Zaremba',    10, NULL),
  ('p0231', 'CAS', 'A', 'Sedoi',      11, NULL),
  ('p0232', 'CAS', 'A', 'Gorodeev',   12, NULL),
  ('p0233', 'CAS', 'P', 'Pedcenko',   19, NULL),
  ('p0234', 'CAS', 'V', 'Graur',      42, NULL),
  ('p0235', 'CAS', 'D', 'Slobodean',  77, NULL)
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO player_seasons (player_id, season, team_id, jersey_number, is_active) VALUES
  ('p0228', '2026/27', 'CAS', 0,  true),
  ('p0229', '2026/27', 'CAS', 4,  true),
  ('p0230', '2026/27', 'CAS', 10, true),
  ('p0231', '2026/27', 'CAS', 11, true),
  ('p0232', '2026/27', 'CAS', 12, true),
  ('p0233', '2026/27', 'CAS', 19, true),
  ('p0234', '2026/27', 'CAS', 42, true),
  ('p0235', '2026/27', 'CAS', 77, true)
ON CONFLICT (player_id, season) DO NOTHING;

COMMIT;

-- ============================================================
-- Notes:
-- - Jersey #22 for Casa Noastra 2 is UNRESOLVED: box score extracted name ". ."
--   (18:26 min, 7 pts played — a real rostered player, just illegible/uncaptured
--   name in the source image). No candidate found in existing rosters or prior
--   name-resolution/aliases. NOT created as a player. Needs manual completion
--   once the real name is known (processing_jobs.id =
--   3c1de0d2-762d-4bdf-8124-5227f69932a9, status "needs_review").
-- - Captains (Adamov O. for CN2, Nartov E. for CAS) are NOT persisted anywhere:
--   no permanent captain field exists on players/player_seasons/teams; is_captain
--   only exists per-game on player_game_stats, out of scope (no stats imported).
-- - Untouched existing CAS players not in this box score (kept active, not
--   deleted): p0001 Tibrigan (#1), p0007 Golovco (#17), p0008 Ceaicovschii (#18).
-- - Flagged for review: Bogatireov/Bogatarev and Priscepnii/Prisepnii/Volceanov/
--   Volcanov matches rely on fuzzy transliteration variants (no exact spelling
--   match) — high confidence (unique candidate, initials match) but not literal.
-- ============================================================
