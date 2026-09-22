-- ============================================================
-- Roster update from FIBA box score dated 2026-09-20:
--   ADMIRALS (ADM) vs ADMIRALS AMBASSADORS (AMB)
-- Box score team code "AM" / "ADMIRLAS AMBASSADORS" (typo) resolved
-- to the existing "ADMIRALS AMBASSADORS" team (team_id = AMB).
-- Applies to season 2026/27 (current season). Run in Supabase SQL editor.
-- Safe to re-run: player inserts use fixed IDs with ON CONFLICT DO NOTHING,
-- jersey/team updates are idempotent.
-- ============================================================

BEGIN;

-- ---- New players (no existing surname match on the roster) ----

INSERT INTO players (player_id, team_id, first_name, last_name, jersey_number, photo_url) VALUES
  ('p0216', 'ADM', 'V', 'Cebotari',     0,  NULL),
  ('p0217', 'ADM', 'L', 'Badarau',      22, NULL),
  ('p0218', 'AMB', 'N', 'Vishineacov',  2,  NULL),
  ('p0219', 'AMB', 'M', 'Moscalciuc',   11, NULL),
  ('p0220', 'AMB', 'A', 'Huba',         45, NULL)
ON CONFLICT (player_id) DO NOTHING;

INSERT INTO player_seasons (player_id, season, team_id, jersey_number, is_active) VALUES
  ('p0216', '2026/27', 'ADM', 0,  true),
  ('p0217', '2026/27', 'ADM', 22, true),
  ('p0218', '2026/27', 'AMB', 2,  true),
  ('p0219', '2026/27', 'AMB', 11, true),
  ('p0220', '2026/27', 'AMB', 45, true)
ON CONFLICT (player_id, season) DO NOTHING;

-- ---- Jersey number corrections for existing matched players ----
-- (surname + first-initial match; box score is authoritative for this game)

-- ADM: Sorocean, A. — 33 -> 3
UPDATE players SET jersey_number = 3 WHERE player_id = 'p0118';
UPDATE player_seasons SET jersey_number = 3 WHERE player_id = 'p0118' AND season = '2026/27';

-- AMB: Finiciuc, R. — 10 -> 0
UPDATE players SET jersey_number = 0 WHERE player_id = '4775e6f0-9151-4982-81ee-399eaef78893';
UPDATE player_seasons SET jersey_number = 0 WHERE player_id = '4775e6f0-9151-4982-81ee-399eaef78893' AND season = '2026/27';

-- AMB: Stoica, V. — 34 -> 13
UPDATE players SET jersey_number = 13 WHERE player_id = 'p0172';
UPDATE player_seasons SET jersey_number = 13 WHERE player_id = 'p0172' AND season = '2026/27';

COMMIT;

-- ============================================================
-- Known jersey-number conflicts left unresolved intentionally
-- (existing players not in this box score were NOT touched):
--   ADM #0  Cebotari V. (new)   vs  Rodion F. (p0115, still active)
--   ADM #3  Sorocean A. (p0118) vs  Alexandr G. (p0206, still active)
--   ADM #22 Badarau L. (new)    vs  Mihai D. (p0193, still active)
--   AMB #0  Finiciuc R. (updated) vs Carabet S. (p0168, still active)
--   AMB #13 Stoica V. (updated)   vs Solosciuc M. (p0023, still active)
-- Also flagged: likely pre-existing duplicate players
--   ADM p0122 "ComnatnIi, G" (jersey 771, typo) vs p0135 "Comnotnii, Gleb" (jersey 77)
--   — box score jersey #77 matches p0135; p0122 was not modified.
-- No captain field exists on players/player_seasons (captain is only
-- stored per-game on player_game_stats.is_captain). Per task scope
-- ("do not import game statistics"), captain status for
-- Epureanu I. (ADM) and Melnicenco M. (AMB) was NOT persisted anywhere.
-- ============================================================
