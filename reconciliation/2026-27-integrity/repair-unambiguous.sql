-- UNAMBIGUOUS repairs (identity proven by roster registration + identical stat line)
-- NOT EXECUTED. Review every statement; run one game block at a time in a SQL console.
-- Every block is a single transaction: any failed precondition or reconciliation check raises and rolls it back.
-- Rollback after COMMIT: restore rows from public.player_game_stats_repair_backup (see rollback section at the end of this file).

-- One-time backup table (schema copy of player_game_stats + audit columns).
CREATE TABLE IF NOT EXISTS public.player_game_stats_repair_backup AS
  SELECT ''::text AS repair_tag, now() AS backed_up_at, p.* FROM public.player_game_stats p WHERE false;

-- ===== g_2026_09_13_AMB_CN2 (AMB 52-85 CN2) =====
-- All actions are unambiguous and the game reconciles after repair.
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_AMB_CN2' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_09_13_AMB_CN2' AND p.player_id IN ('p0250', 'p0218', 'p0007', 'p0222', 'p0021', 'p0224') ON CONFLICT DO NOTHING;
-- reassign: VisneakovN p0218 -> p0250 (Nichita Visneacov), points 4
UPDATE public.player_game_stats SET player_id = 'p0250' WHERE game_id = 'g_2026_09_13_AMB_CN2' AND player_id = 'p0218' AND team_id = 'AMB' AND points = 4;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_AMB_CN2' AND player_id = 'p0250' AND points = 4) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_AMB_CN2 p0218 -> p0250'; END IF; END $$;
-- insert p0007 (Ion Golovco), points 4
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_AMB_CN2', '83bbe6da-6737-4fb0-a253-b7e23e4e3e06', 'p0007', 'AMB', FALSE, FALSE, FALSE, '22:59', 2, 7, 2, 4, 0, 3, 0, 0, 3, 3, 6, 0, 3, 4, 0, 2, 2, -12, NULL, 4 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_AMB_CN2' AND player_id = 'p0007');
-- insert p0222 (V Martanov), points 6
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_AMB_CN2', '83bbe6da-6737-4fb0-a253-b7e23e4e3e06', 'p0222', 'CN2', FALSE, FALSE, FALSE, '11:51', 2, 7, 0, 5, 2, 2, 0, 0, 1, 1, 2, 0, 1, 0, 0, 2, 0, -2, NULL, 6 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_AMB_CN2' AND player_id = 'p0222');
-- insert p0021 (Alic Tonciu), points 10
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_AMB_CN2', '83bbe6da-6737-4fb0-a253-b7e23e4e3e06', 'p0021', 'CN2', TRUE, TRUE, FALSE, '24:54', 5, 11, 5, 8, 0, 3, 0, 2, 4, 1, 5, 4, 3, 0, 0, 1, 1, 30, NULL, 10 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_AMB_CN2' AND player_id = 'p0021');
-- insert p0224 (V Jeregi), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_AMB_CN2', '83bbe6da-6737-4fb0-a253-b7e23e4e3e06', 'p0224', 'CN2', FALSE, FALSE, FALSE, '09:10', 0, 1, 0, 0, 0, 1, 0, 0, 1, 2, 3, 1, 1, 1, 0, 2, 0, 11, NULL, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_AMB_CN2' AND player_id = 'p0224');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_AMB_CN2' AND team_id = 'AMB') <> 52 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_13_AMB_CN2 AMB expected 52'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_AMB_CN2' AND team_id = 'CN2') <> 85 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_13_AMB_CN2 CN2 expected 85'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_AMB_CN2' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_09_20_WOL_GTM (WOL 69-79 GTM) =====
-- All actions are unambiguous and the game reconciles after repair.
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_20_WOL_GTM' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_09_20_WOL_GTM' AND p.player_id IN ('p0208', '97e8af72-b2a6-412b-879e-b8a0d2b9fb9d', 'p0161', 'p0077') ON CONFLICT DO NOTHING;
-- reassign: Secrieru V p0077 -> p0161 (Vadim Secrieru), points 2
UPDATE public.player_game_stats SET player_id = 'p0161' WHERE game_id = 'g_2026_09_20_WOL_GTM' AND player_id = 'p0077' AND team_id = 'WOL' AND points = 2;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_20_WOL_GTM' AND player_id = 'p0161' AND points = 2) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_20_WOL_GTM p0077 -> p0161'; END IF; END $$;
-- reassign: Burduja I 97e8af72-b2a6-412b-879e-b8a0d2b9fb9d -> p0208 (Igor Burduja), points 5
UPDATE public.player_game_stats SET player_id = 'p0208' WHERE game_id = 'g_2026_09_20_WOL_GTM' AND player_id = '97e8af72-b2a6-412b-879e-b8a0d2b9fb9d' AND team_id = 'WOL' AND points = 5;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_20_WOL_GTM' AND player_id = 'p0208' AND points = 5) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_20_WOL_GTM 97e8af72-b2a6-412b-879e-b8a0d2b9fb9d -> p0208'; END IF; END $$;
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_20_WOL_GTM' AND team_id = 'WOL') <> 69 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_20_WOL_GTM WOL expected 69'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_20_WOL_GTM' AND team_id = 'GTM') <> 79 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_20_WOL_GTM GTM expected 79'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_20_WOL_GTM' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_10_18_CN2_EDI (CN2 88-54 EDI) =====
-- All actions are unambiguous and the game reconciles after repair.
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_CN2_EDI' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_10_18_CN2_EDI' AND p.player_id IN ('p0249', 'p0227', 'p0224') ON CONFLICT DO NOTHING;
-- reassign: D SFAPTI p0224 -> p0227 (A Streapko), points 0
UPDATE public.player_game_stats SET player_id = 'p0227' WHERE game_id = 'g_2026_10_18_CN2_EDI' AND player_id = 'p0224' AND team_id = 'CN2' AND points = 0;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_CN2_EDI' AND player_id = 'p0227' AND points = 0) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_18_CN2_EDI p0224 -> p0227'; END IF; END $$;
-- insert p0249 (Genadii Kuceriavii), points 4
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_18_CN2_EDI', '20a9143a-0dbe-4b66-9a65-5d530b7ccac9', 'p0249', 'CN2', FALSE, FALSE, FALSE, '22:30', 2, 8, 2, 5, 0, 3, 0, 0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 27, 1, 4 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_CN2_EDI' AND player_id = 'p0249');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_CN2_EDI' AND team_id = 'CN2') <> 88 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_18_CN2_EDI CN2 expected 88'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_CN2_EDI' AND team_id = 'EDI') <> 54 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_18_CN2_EDI EDI expected 54'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_CN2_EDI' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_10_18_WOL_CAS (WOL 74-90 CAS) =====
-- All actions are unambiguous and the game reconciles after repair.
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_WOL_CAS' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_10_18_WOL_CAS' AND p.player_id IN ('p0253') ON CONFLICT DO NOTHING;
-- insert p0253 (Martin Arzumanian), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_18_WOL_CAS', '6000968c-5ad2-413e-ae97-83285f9a9202', 'p0253', 'CAS', FALSE, FALSE, FALSE, '00:01', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, -5, -1, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_WOL_CAS' AND player_id = 'p0253');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_WOL_CAS' AND team_id = 'WOL') <> 74 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_18_WOL_CAS WOL expected 74'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_WOL_CAS' AND team_id = 'CAS') <> 90 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_18_WOL_CAS CAS expected 90'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_WOL_CAS' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== ROLLBACK GUIDANCE (after COMMIT) =====
-- For a game <GID>, restore only the rows this script touched:
--   BEGIN;
--   DELETE FROM public.player_game_stats WHERE game_id = '<GID>' AND player_id IN (<every player_id named in that game block: inserted ids, reassign sources and targets, updated ids>);
--   INSERT INTO public.player_game_stats SELECT (jsonb_populate_record(NULL::public.player_game_stats, to_jsonb(b))).* FROM public.player_game_stats_repair_backup b WHERE b.repair_tag = 'repair-2026-27' AND b.game_id = '<GID>';
--   COMMIT;
-- Inserted rows are removed by player_id (listed in each block's comments); reassigned/updated rows come back from the backup.
