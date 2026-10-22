-- PARTIAL repairs: unambiguous actions for games that ALSO have manual-review items (e.g. a missing roster registration). The in-block reconciliation guard still applies and rolls the block back if the game does not reconcile.
-- NOT EXECUTED. Review every statement; run one game block at a time in a SQL console.
-- Every block is a single transaction: any failed precondition or reconciliation check raises and rolls it back.
-- Rollback after COMMIT: restore rows from public.player_game_stats_repair_backup (see rollback section at the end of this file).
-- Resolve the manual items in repair-plan.md (section 4) first or in addition.
-- One-time backup table (schema copy of player_game_stats + audit columns).
CREATE TABLE IF NOT EXISTS public.player_game_stats_repair_backup AS
  SELECT ''::text AS repair_tag, now() AS backed_up_at, p.* FROM public.player_game_stats p WHERE false;

-- ===== g_2026_09_13_USM_WOL (USM 84-49 WOL) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_USM_WOL' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_09_13_USM_WOL' AND p.player_id IN ('p0208', '97e8af72-b2a6-412b-879e-b8a0d2b9fb9d', 'p0161', 'p0077') ON CONFLICT DO NOTHING;
-- reassign: Secrieru V p0077 -> p0161 (Vadim Secrieru), points 8
UPDATE public.player_game_stats SET player_id = 'p0161' WHERE game_id = 'g_2026_09_13_USM_WOL' AND player_id = 'p0077' AND team_id = 'WOL' AND points = 8;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_USM_WOL' AND player_id = 'p0161' AND points = 8) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_USM_WOL p0077 -> p0161'; END IF; END $$;
-- reassign: Burdeja I 97e8af72-b2a6-412b-879e-b8a0d2b9fb9d -> p0208 (Igor Burduja), points 4
UPDATE public.player_game_stats SET player_id = 'p0208' WHERE game_id = 'g_2026_09_13_USM_WOL' AND player_id = '97e8af72-b2a6-412b-879e-b8a0d2b9fb9d' AND team_id = 'WOL' AND points = 4;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_USM_WOL' AND player_id = 'p0208' AND points = 4) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_USM_WOL 97e8af72-b2a6-412b-879e-b8a0d2b9fb9d -> p0208'; END IF; END $$;
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_USM_WOL' AND team_id = 'USM') <> 84 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_13_USM_WOL USM expected 84'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_USM_WOL' AND team_id = 'WOL') <> 49 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_13_USM_WOL WOL expected 49'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_USM_WOL' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_09_13_EDI_DRO (EDI 49-85 DRO) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_09_13_EDI_DRO' AND p.player_id IN ('95c4aaea-e486-41f8-8dfd-5b6cd3359663', 'p0104', 'p0163', 'p0106', '12f37ef9-2c89-4fa3-b77d-dc954da6a474', 'p0110', 'b96c2125-601b-4900-9e95-84f362d3de30', '2a79386c-6451-4fb9-9f79-a56586022ffd', 'p0061', '7869f453-98b9-4864-b60f-d8eb914aff6a', '58587871-e92c-4526-8416-e9226078ebfc', 'p0056', 'c9e3440b-6179-4bda-849c-9df0331c0c62', 'p0064', 'p0157', '1825d196-6afa-4456-b074-164eda037668', 'p0062', '877960cb-8870-4469-b894-7fbf9d8f44ca', 'p0158') ON CONFLICT DO NOTHING;
-- reassign: Andrei R 2a79386c-6451-4fb9-9f79-a56586022ffd -> b96c2125-601b-4900-9e95-84f362d3de30 (Andrei Rusu), points 18
UPDATE public.player_game_stats SET player_id = 'b96c2125-601b-4900-9e95-84f362d3de30' WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = '2a79386c-6451-4fb9-9f79-a56586022ffd' AND team_id = 'EDI' AND points = 18;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'b96c2125-601b-4900-9e95-84f362d3de30' AND points = 18) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_EDI_DRO 2a79386c-6451-4fb9-9f79-a56586022ffd -> b96c2125-601b-4900-9e95-84f362d3de30'; END IF; END $$;
-- reassign: Andrei P p0158 -> 877960cb-8870-4469-b894-7fbf9d8f44ca (A Hirbu), points 3
UPDATE public.player_game_stats SET player_id = '877960cb-8870-4469-b894-7fbf9d8f44ca' WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0158' AND team_id = 'DRO' AND points = 3;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = '877960cb-8870-4469-b894-7fbf9d8f44ca' AND points = 3) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_EDI_DRO p0158 -> 877960cb-8870-4469-b894-7fbf9d8f44ca'; END IF; END $$;
-- reassign: Dorin B p0110 -> 12f37ef9-2c89-4fa3-b77d-dc954da6a474 (Dorin Bocancea), points 10
UPDATE public.player_game_stats SET player_id = '12f37ef9-2c89-4fa3-b77d-dc954da6a474' WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0110' AND team_id = 'EDI' AND points = 10;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = '12f37ef9-2c89-4fa3-b77d-dc954da6a474' AND points = 10) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_EDI_DRO p0110 -> 12f37ef9-2c89-4fa3-b77d-dc954da6a474'; END IF; END $$;
-- reassign: Ivan I p0061 -> p0062 (V Panaite), points 12
UPDATE public.player_game_stats SET player_id = 'p0062' WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0061' AND team_id = 'DRO' AND points = 12;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0062' AND points = 12) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_EDI_DRO p0061 -> p0062'; END IF; END $$;
-- reassign: Alexandr U p0106 -> p0163 (Alexandru Gronic), points 6
UPDATE public.player_game_stats SET player_id = 'p0163' WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0106' AND team_id = 'EDI' AND points = 6;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0163' AND points = 6) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_EDI_DRO p0106 -> p0163'; END IF; END $$;
-- reassign: Marius C 1825d196-6afa-4456-b074-164eda037668 -> p0157 (Marius Stina), points 2
UPDATE public.player_game_stats SET player_id = 'p0157' WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = '1825d196-6afa-4456-b074-164eda037668' AND team_id = 'DRO' AND points = 2;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0157' AND points = 2) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_EDI_DRO 1825d196-6afa-4456-b074-164eda037668 -> p0157'; END IF; END $$;
-- reassign: Denis P p0104 -> 95c4aaea-e486-41f8-8dfd-5b6cd3359663 (Denis Palataicov), points 2
UPDATE public.player_game_stats SET player_id = '95c4aaea-e486-41f8-8dfd-5b6cd3359663' WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0104' AND team_id = 'EDI' AND points = 2;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = '95c4aaea-e486-41f8-8dfd-5b6cd3359663' AND points = 2) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_EDI_DRO p0104 -> 95c4aaea-e486-41f8-8dfd-5b6cd3359663'; END IF; END $$;
-- reassign: Ivan .M p0064 -> c9e3440b-6179-4bda-849c-9df0331c0c62 (Ion Mitisov), points 39
UPDATE public.player_game_stats SET player_id = 'c9e3440b-6179-4bda-849c-9df0331c0c62' WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0064' AND team_id = 'DRO' AND points = 39;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'c9e3440b-6179-4bda-849c-9df0331c0c62' AND points = 39) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_EDI_DRO p0064 -> c9e3440b-6179-4bda-849c-9df0331c0c62'; END IF; END $$;
-- reassign: Matvei B p0056 -> 58587871-e92c-4526-8416-e9226078ebfc (Matei Barbara), points 0
UPDATE public.player_game_stats SET player_id = '58587871-e92c-4526-8416-e9226078ebfc' WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0056' AND team_id = 'DRO' AND points = 0;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = '58587871-e92c-4526-8416-e9226078ebfc' AND points = 0) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_EDI_DRO p0056 -> 58587871-e92c-4526-8416-e9226078ebfc'; END IF; END $$;
-- reassign: ilia C 7869f453-98b9-4864-b60f-d8eb914aff6a -> p0061 (Ion Iatco), points 0
UPDATE public.player_game_stats SET player_id = 'p0061' WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = '7869f453-98b9-4864-b60f-d8eb914aff6a' AND team_id = 'DRO' AND points = 0;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND player_id = 'p0061' AND points = 0) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_13_EDI_DRO 7869f453-98b9-4864-b60f-d8eb914aff6a -> p0061'; END IF; END $$;
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND team_id = 'EDI') <> 49 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_13_EDI_DRO EDI expected 49'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' AND team_id = 'DRO') <> 85 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_13_EDI_DRO DRO expected 85'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_EDI_DRO' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_09_13_GTM_BLD (GTM 78-47 BLD) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_09_13_GTM_BLD' AND p.player_id IN ('43a359a1-4bfd-4715-bc50-28c564f101c1', 'ee6c9ceb-f22e-4f4f-afcd-62971da4671e', 'p0067', 'p0068', 'p0201', '0964080c-3e6a-4c4d-b937-491d20c871f0', 'p0070', 'p0071', 'f3afe091-8f9f-4d7d-9915-9f9212dfd5bd', 'p0073') ON CONFLICT DO NOTHING;
-- insert 43a359a1-4bfd-4715-bc50-28c564f101c1 (Roman Pisariuc), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_GTM_BLD', '8496970e-be02-432c-80de-1e5b73941669', '43a359a1-4bfd-4715-bc50-28c564f101c1', 'BLD', FALSE, FALSE, FALSE, '10:39', 0, 5, 0, 2, 0, 3, 0, 2, 2, 2, 4, 0, 3, 0, 0, 2, 1, -17, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND player_id = '43a359a1-4bfd-4715-bc50-28c564f101c1');
-- insert ee6c9ceb-f22e-4f4f-afcd-62971da4671e (Nichita Ciorba), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_GTM_BLD', '8496970e-be02-432c-80de-1e5b73941669', 'ee6c9ceb-f22e-4f4f-afcd-62971da4671e', 'BLD', FALSE, FALSE, FALSE, '14:38', 0, 4, 0, 4, 0, 0, 0, 2, 2, 3, 5, 0, 5, 0, 0, 1, 3, -23, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND player_id = 'ee6c9ceb-f22e-4f4f-afcd-62971da4671e');
-- insert p0067 (S Coscodan), points 6
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_GTM_BLD', '8496970e-be02-432c-80de-1e5b73941669', 'p0067', 'BLD', TRUE, FALSE, FALSE, '26:31', 1, 5, 1, 5, 0, 0, 4, 7, 3, 6, 9, 3, 4, 1, 0, 4, 6, -9, 6, 6 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND player_id = 'p0067');
-- insert p0068 (S Buruiana), points 4
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_GTM_BLD', '8496970e-be02-432c-80de-1e5b73941669', 'p0068', 'BLD', TRUE, FALSE, FALSE, '28:15', 1, 7, 0, 1, 1, 6, 1, 1, 0, 1, 1, 1, 2, 2, 0, 3, 1, -9, 4, 4 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND player_id = 'p0068');
-- insert p0201 (Denis Bostan), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_GTM_BLD', '8496970e-be02-432c-80de-1e5b73941669', 'p0201', 'BLD', FALSE, FALSE, FALSE, '05:26', 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 2, 1, -10, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND player_id = 'p0201');
-- insert 0964080c-3e6a-4c4d-b937-491d20c871f0 (Roman Mosenschii), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_GTM_BLD', '8496970e-be02-432c-80de-1e5b73941669', '0964080c-3e6a-4c4d-b937-491d20c871f0', 'BLD', FALSE, FALSE, FALSE, '07:37', 0, 1, 0, 1, 0, 0, 0, 0, 2, 1, 3, 0, 4, 0, 0, 0, 0, -10, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND player_id = '0964080c-3e6a-4c4d-b937-491d20c871f0');
-- insert p0070 (A Slobodean), points 6
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_GTM_BLD', '8496970e-be02-432c-80de-1e5b73941669', 'p0070', 'BLD', TRUE, FALSE, FALSE, '22:33', 3, 3, 3, 3, 0, 0, 0, 0, 0, 2, 2, 0, 2, 0, 1, 0, 0, -13, 6, 6 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND player_id = 'p0070');
-- insert p0071 (Alexander Saenco), points 1
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_GTM_BLD', '8496970e-be02-432c-80de-1e5b73941669', 'p0071', 'BLD', TRUE, FALSE, FALSE, '13:03', 0, 0, 0, 0, 0, 0, 1, 4, 2, 1, 3, 0, 1, 0, 0, 2, 2, -9, 1, 1 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND player_id = 'p0071');
-- insert f3afe091-8f9f-4d7d-9915-9f9212dfd5bd (Vactor Stoicov), points 17
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_GTM_BLD', '8496970e-be02-432c-80de-1e5b73941669', 'f3afe091-8f9f-4d7d-9915-9f9212dfd5bd', 'BLD', FALSE, TRUE, FALSE, '23:49', 6, 11, 1, 4, 5, 7, 0, 0, 2, 2, 4, 0, 1, 0, 0, 5, 0, -24, 17, 17 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND player_id = 'f3afe091-8f9f-4d7d-9915-9f9212dfd5bd');
-- insert p0073 (D Tcaciov), points 9
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_13_GTM_BLD', '8496970e-be02-432c-80de-1e5b73941669', 'p0073', 'BLD', TRUE, FALSE, FALSE, '29:30', 4, 7, 3, 4, 1, 3, 0, 0, 1, 5, 6, 2, 4, 0, 0, 3, 1, -18, 9, 9 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND player_id = 'p0073');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND team_id = 'GTM') <> 78 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_13_GTM_BLD GTM expected 78'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' AND team_id = 'BLD') <> 47 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_13_GTM_BLD BLD expected 47'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_13_GTM_BLD' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_09_27_BLD_HAI (BLD 55-59 HAI) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_09_27_BLD_HAI' AND p.player_id IN ('p0212', 'p0066', 'ae90fc95-7497-4eb4-b5ef-2d634d237204', '0fd7ff3f-3740-49a2-b634-68137bebd31c', 'ee6c9ceb-f22e-4f4f-afcd-62971da4671e', 'p0068', '0964080c-3e6a-4c4d-b937-491d20c871f0', 'p0204', 'f3afe091-8f9f-4d7d-9915-9f9212dfd5bd', 'p0073', 'p0145') ON CONFLICT DO NOTHING;
-- insert p0212 (Nichita Tonciu), points 2
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', 'p0212', 'BLD', FALSE, FALSE, FALSE, '04:36', 1, 1, 1, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 2, 2 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = 'p0212');
-- insert p0066 (I Revazov), points 2
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', 'p0066', 'BLD', FALSE, FALSE, FALSE, '29:45', 1, 8, 1, 2, 0, 6, 0, 1, 2, 7, 9, 5, 6, 0, 1, 1, 3, -1, 3, 2 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = 'p0066');
-- insert ae90fc95-7497-4eb4-b5ef-2d634d237204 (Artiom Levitchii), points 1
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', 'ae90fc95-7497-4eb4-b5ef-2d634d237204', 'BLD', TRUE, FALSE, FALSE, '16:24', 0, 3, 0, 1, 0, 2, 1, 2, 1, 4, 5, 0, 5, 2, 0, 3, 1, -4, -1, 1 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = 'ae90fc95-7497-4eb4-b5ef-2d634d237204');
-- insert 0fd7ff3f-3740-49a2-b634-68137bebd31c (Artur Tonciu), points 7
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', '0fd7ff3f-3740-49a2-b634-68137bebd31c', 'BLD', TRUE, TRUE, FALSE, '27:15', 3, 6, 3, 6, 0, 0, 1, 3, 2, 3, 5, 1, 5, 2, 0, 4, 3, 2, 5, 7 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = '0fd7ff3f-3740-49a2-b634-68137bebd31c');
-- insert ee6c9ceb-f22e-4f4f-afcd-62971da4671e (Nichita Ciorba), points 11
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', 'ee6c9ceb-f22e-4f4f-afcd-62971da4671e', 'BLD', TRUE, FALSE, FALSE, '24:18', 4, 11, 3, 7, 1, 4, 2, 2, 1, 0, 1, 0, 5, 1, 0, 2, 3, -6, 1, 11 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = 'ee6c9ceb-f22e-4f4f-afcd-62971da4671e');
-- insert p0068 (S Buruiana), points 7
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', 'p0068', 'BLD', FALSE, FALSE, FALSE, '33:00', 3, 10, 2, 2, 1, 8, 0, 0, 0, 3, 3, 1, 1, 1, 0, 3, 2, -4, 4, 7 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = 'p0068');
-- insert 0964080c-3e6a-4c4d-b937-491d20c871f0 (Roman Mosenschii), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', '0964080c-3e6a-4c4d-b937-491d20c871f0', 'BLD', FALSE, FALSE, FALSE, '02:43', 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, -6, 1, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = '0964080c-3e6a-4c4d-b937-491d20c871f0');
-- insert p0204 (M Popovici), points 4
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', 'p0204', 'BLD', FALSE, FALSE, FALSE, '09:38', 2, 3, 2, 2, 0, 1, 0, 0, 1, 3, 4, 1, 3, 0, 0, 1, 1, -6, 5, 4 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = 'p0204');
-- insert f3afe091-8f9f-4d7d-9915-9f9212dfd5bd (Vactor Stoicov), points 17
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', 'f3afe091-8f9f-4d7d-9915-9f9212dfd5bd', 'BLD', TRUE, FALSE, FALSE, '29:18', 7, 11, 6, 6, 1, 5, 2, 3, 1, 5, 6, 0, 5, 2, 1, 4, 4, -2, 16, 17 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = 'f3afe091-8f9f-4d7d-9915-9f9212dfd5bd');
-- insert p0073 (D Tcaciov), points 4
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', 'p0073', 'BLD', TRUE, FALSE, FALSE, '23:03', 1, 5, 0, 3, 1, 2, 1, 2, 2, 3, 5, 1, 2, 3, 0, 5, 1, 6, 6, 4 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = 'p0073');
-- insert p0145 (Alexandr Kalashnikov), points 8
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_09_27_BLD_HAI', '41f8b794-513b-42da-8b10-c14b49a8210c', 'p0145', 'HAI', TRUE, FALSE, FALSE, '30:12', 4, 8, 4, 7, 0, 1, 0, 2, 6, 5, 11, 0, 4, 2, 0, 5, 4, 10, 11, 8 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND player_id = 'p0145');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND team_id = 'BLD') <> 55 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_27_BLD_HAI BLD expected 55'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' AND team_id = 'HAI') <> 59 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_27_BLD_HAI HAI expected 59'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_BLD_HAI' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_09_27_CAS_ADM (CAS 89-50 ADM) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_CAS_ADM' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_09_27_CAS_ADM' AND p.player_id IN ('p0255', 'p0131', 'p0124', 'p0134') ON CONFLICT DO NOTHING;
-- reassign: I EPUREANU p0134 -> p0124 (Ianis Epureanu), points 7
UPDATE public.player_game_stats SET player_id = 'p0124' WHERE game_id = 'g_2026_09_27_CAS_ADM' AND player_id = 'p0134' AND team_id = 'ADM' AND points = 7;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_CAS_ADM' AND player_id = 'p0124' AND points = 7) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_27_CAS_ADM p0134 -> p0124'; END IF; END $$;
-- reassign: A TURCANU p0131 -> p0255 (Alexei Turcanu), points 0
UPDATE public.player_game_stats SET player_id = 'p0255' WHERE game_id = 'g_2026_09_27_CAS_ADM' AND player_id = 'p0131' AND team_id = 'ADM' AND points = 0;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_CAS_ADM' AND player_id = 'p0255' AND points = 0) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_09_27_CAS_ADM p0131 -> p0255'; END IF; END $$;
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_CAS_ADM' AND team_id = 'CAS') <> 89 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_27_CAS_ADM CAS expected 89'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_CAS_ADM' AND team_id = 'ADM') <> 50 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_09_27_CAS_ADM ADM expected 50'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_09_27_CAS_ADM' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_10_04_EDI_CAS (EDI 57-76 CAS) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_10_04_EDI_CAS' AND p.player_id IN ('p0163', '2d0c1f78-2d2b-42e1-891f-b7a79506c188', 'p0252', 'p0228', 'p0232', 'p0231', 'p0234', 'p0251', 'p0254', 'p0235', 'p0253') ON CONFLICT DO NOTHING;
-- reassign: AlexandrG 2d0c1f78-2d2b-42e1-891f-b7a79506c188 -> p0163 (Alexandru Gronic), points 0
UPDATE public.player_game_stats SET player_id = 'p0163' WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = '2d0c1f78-2d2b-42e1-891f-b7a79506c188' AND team_id = 'EDI' AND points = 0;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0163' AND points = 0) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_04_EDI_CAS 2d0c1f78-2d2b-42e1-891f-b7a79506c188 -> p0163'; END IF; END $$;
-- reassign: Artem G p0232 -> p0234 (V Graur), points 0
UPDATE public.player_game_stats SET player_id = 'p0234' WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0232' AND team_id = 'CAS' AND points = 0;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0234' AND points = 0) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_04_EDI_CAS p0232 -> p0234'; END IF; END $$;
-- reassign: Alexandr S p0231 -> p0232 (A Gorodeev), points 2
UPDATE public.player_game_stats SET player_id = 'p0232' WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0231' AND team_id = 'CAS' AND points = 2;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0232' AND points = 2) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_04_EDI_CAS p0231 -> p0232'; END IF; END $$;
-- reassign: Danila I p0228 -> p0252 (Danila Kravchenko), points 9
UPDATE public.player_game_stats SET player_id = 'p0252' WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0228' AND team_id = 'CAS' AND points = 9;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0252' AND points = 9) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_04_EDI_CAS p0228 -> p0252'; END IF; END $$;
-- reassign: Dmitrii S p0235 -> p0228 (D Iarovoi), points 0
UPDATE public.player_game_stats SET player_id = 'p0228' WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0235' AND team_id = 'CAS' AND points = 0;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0228' AND points = 0) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_04_EDI_CAS p0235 -> p0228'; END IF; END $$;
-- insert p0251 (Semen Goldstein), points 4
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_EDI_CAS', 'c5c36635-66ee-4f86-831d-c628944a40c6', 'p0251', 'CAS', FALSE, FALSE, FALSE, '25:44', 2, 5, 2, 3, 0, 2, 0, 0, 2, 6, 8, 1, 2, 1, 0, 3, 0, 12, 9, 4 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0251');
-- insert p0254 (Stanislav Goldstein), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_EDI_CAS', 'c5c36635-66ee-4f86-831d-c628944a40c6', 'p0254', 'CAS', TRUE, FALSE, FALSE, '10:38', 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0254');
-- insert p0253 (Martin Arzumanian), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_EDI_CAS', 'c5c36635-66ee-4f86-831d-c628944a40c6', 'p0253', 'CAS', FALSE, FALSE, FALSE, '04:01', 0, 0, 0, 0, 0, 0, 0, 2, 1, 2, 3, 0, 1, 0, 0, 1, 1, -5, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' AND player_id = 'p0253');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' AND team_id = 'EDI') <> 57 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_04_EDI_CAS EDI expected 57'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' AND team_id = 'CAS') <> 76 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_04_EDI_CAS CAS expected 76'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_EDI_CAS' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_10_04_GTM_COM (GTM 80-65 COM) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_GTM_COM' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_10_04_GTM_COM' AND p.player_id IN ('p0240', 'p0236', 'p0237', 'p0239', 'p0246') ON CONFLICT DO NOTHING;
-- insert p0240 (Victor Leiciu), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_GTM_COM', '412be072-8284-4583-bdd9-4b63d646521c', 'p0240', 'COM', FALSE, FALSE, FALSE, '04:29', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_GTM_COM' AND player_id = 'p0240');
-- insert p0236 (Vladimir Dimoglo), points 9
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_GTM_COM', '412be072-8284-4583-bdd9-4b63d646521c', 'p0236', 'COM', TRUE, FALSE, FALSE, '36:21', 4, 9, 4, 8, 0, 1, 1, 2, 1, 7, 8, 6, 5, 0, 0, 3, 3, -14, 12, 9 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_GTM_COM' AND player_id = 'p0236');
-- insert p0237 (Daniil Dimitroglo), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_GTM_COM', '412be072-8284-4583-bdd9-4b63d646521c', 'p0237', 'COM', FALSE, FALSE, FALSE, '04:46', 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, -4, -1, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_GTM_COM' AND player_id = 'p0237');
-- insert p0239 (Roman Barladean), points 2
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_GTM_COM', '412be072-8284-4583-bdd9-4b63d646521c', 'p0239', 'COM', FALSE, FALSE, FALSE, '18:23', 1, 4, 1, 4, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 1, 0, -2, 1, 2 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_GTM_COM' AND player_id = 'p0239');
-- insert p0246 (Stepan Peadisev), points 2
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_GTM_COM', '412be072-8284-4583-bdd9-4b63d646521c', 'p0246', 'COM', FALSE, FALSE, FALSE, '05:49', 1, 2, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 1, 2 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_GTM_COM' AND player_id = 'p0246');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_GTM_COM' AND team_id = 'GTM') <> 80 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_04_GTM_COM GTM expected 80'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_GTM_COM' AND team_id = 'COM') <> 65 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_04_GTM_COM COM expected 65'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_GTM_COM' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_10_04_BLD_AMB (BLD 57-50 AMB) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_BLD_AMB' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_10_04_BLD_AMB' AND p.player_id IN ('ae90fc95-7497-4eb4-b5ef-2d634d237204', 'p0070', 'p0071', 'p0218', 'p0220') ON CONFLICT DO NOTHING;
-- reassign: N VISHNEACOV p0220 -> p0218 (N Vishineacov), points 0
UPDATE public.player_game_stats SET player_id = 'p0218' WHERE game_id = 'g_2026_10_04_BLD_AMB' AND player_id = 'p0220' AND team_id = 'AMB' AND points = 0;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_BLD_AMB' AND player_id = 'p0218' AND points = 0) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_04_BLD_AMB p0220 -> p0218'; END IF; END $$;
-- insert ae90fc95-7497-4eb4-b5ef-2d634d237204 (Artiom Levitchii), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_BLD_AMB', 'c3d52bbd-df28-4ac4-b943-95ac500d0f98', 'ae90fc95-7497-4eb4-b5ef-2d634d237204', 'BLD', TRUE, TRUE, FALSE, '20:17', 0, 3, 0, 1, 0, 2, 0, 0, 0, 5, 5, 0, 1, 0, 0, 3, 1, 4, 1, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_BLD_AMB' AND player_id = 'ae90fc95-7497-4eb4-b5ef-2d634d237204');
-- insert p0070 (A Slobodean), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_BLD_AMB', 'c3d52bbd-df28-4ac4-b943-95ac500d0f98', 'p0070', 'BLD', FALSE, FALSE, FALSE, '16:06', 0, 3, 0, 3, 0, 0, 0, 0, 0, 2, 2, 1, 1, 1, 0, 1, 0, -3, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_BLD_AMB' AND player_id = 'p0070');
-- insert p0071 (Alexander Saenco), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_04_BLD_AMB', 'c3d52bbd-df28-4ac4-b943-95ac500d0f98', 'p0071', 'BLD', FALSE, FALSE, FALSE, '03:55', 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -4, -1, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_BLD_AMB' AND player_id = 'p0071');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_BLD_AMB' AND team_id = 'BLD') <> 57 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_04_BLD_AMB BLD expected 57'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_BLD_AMB' AND team_id = 'AMB') <> 50 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_04_BLD_AMB AMB expected 50'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_04_BLD_AMB' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_10_11_CAS_BLD (CAS 91-61 BLD) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_10_11_CAS_BLD' AND p.player_id IN ('p0251', 'p0252', 'p0234', 'p0253', 'p0212', '67e824d0-2029-4ece-8aa1-9178de2c566e', 'ee6c9ceb-f22e-4f4f-afcd-62971da4671e', '43a359a1-4bfd-4715-bc50-28c564f101c1', 'p0213', 'p0071', 'p0073') ON CONFLICT DO NOTHING;
-- reassign: * * p0234 -> p0252 (Danila Kravchenko), points 2
UPDATE public.player_game_stats SET player_id = 'p0252' WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = 'p0234' AND team_id = 'CAS' AND points = 2;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = 'p0252' AND points = 2) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_11_CAS_BLD p0234 -> p0252'; END IF; END $$;
-- insert p0251 (Semen Goldstein), points 8
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_11_CAS_BLD', '1b34d14e-fd95-4389-9a16-d7b11b0b9a65', 'p0251', 'CAS', TRUE, FALSE, FALSE, '20:46', 4, 11, 4, 10, 0, 1, 0, 0, 3, 6, 9, 0, 2, 0, 0, 5, 0, 35, 8, 8 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = 'p0251');
-- insert p0253 (Martin Arzumanian), points 0
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_11_CAS_BLD', '1b34d14e-fd95-4389-9a16-d7b11b0b9a65', 'p0253', 'CAS', FALSE, FALSE, FALSE, '04:13', 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, -1, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = 'p0253');
-- insert p0212 (Nichita Tonciu), points 2
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_11_CAS_BLD', '1b34d14e-fd95-4389-9a16-d7b11b0b9a65', 'p0212', 'BLD', FALSE, FALSE, FALSE, '20:58', 0, 5, 0, 3, 0, 2, 2, 2, 1, 2, 3, 0, 0, 0, 0, 0, 1, -19, 0, 2 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = 'p0212');
-- insert 67e824d0-2029-4ece-8aa1-9178de2c566e (Petea Romanov), points 2
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_11_CAS_BLD', '1b34d14e-fd95-4389-9a16-d7b11b0b9a65', '67e824d0-2029-4ece-8aa1-9178de2c566e', 'BLD', FALSE, FALSE, FALSE, '12:23', 1, 2, 1, 2, 0, 0, 0, 0, 0, 4, 4, 0, 3, 0, 0, 2, 1, -14, 2, 2 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = '67e824d0-2029-4ece-8aa1-9178de2c566e');
-- insert ee6c9ceb-f22e-4f4f-afcd-62971da4671e (Nichita Ciorba), points 15
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_11_CAS_BLD', '1b34d14e-fd95-4389-9a16-d7b11b0b9a65', 'ee6c9ceb-f22e-4f4f-afcd-62971da4671e', 'BLD', TRUE, FALSE, FALSE, '22:17', 6, 13, 5, 9, 1, 4, 2, 2, 2, 4, 6, 1, 1, 1, 0, 3, 6, -3, 15, 15 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = 'ee6c9ceb-f22e-4f4f-afcd-62971da4671e');
-- insert 43a359a1-4bfd-4715-bc50-28c564f101c1 (Roman Pisariuc), points 2
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_11_CAS_BLD', '1b34d14e-fd95-4389-9a16-d7b11b0b9a65', '43a359a1-4bfd-4715-bc50-28c564f101c1', 'BLD', FALSE, FALSE, FALSE, '16:30', 1, 6, 1, 6, 0, 0, 0, 0, 4, 2, 6, 1, 0, 0, 0, 0, 0, -4, 4, 2 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = '43a359a1-4bfd-4715-bc50-28c564f101c1');
-- insert p0213 (Alex Rencev), points 3
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_11_CAS_BLD', '1b34d14e-fd95-4389-9a16-d7b11b0b9a65', 'p0213', 'BLD', FALSE, FALSE, FALSE, '15:08', 1, 2, 0, 1, 1, 1, 0, 0, 1, 1, 2, 0, 1, 1, 0, 1, 1, -9, 4, 3 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = 'p0213');
-- insert p0071 (Alexander Saenco), points 4
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_11_CAS_BLD', '1b34d14e-fd95-4389-9a16-d7b11b0b9a65', 'p0071', 'BLD', FALSE, FALSE, FALSE, '14:08', 1, 7, 1, 6, 0, 1, 2, 2, 2, 2, 4, 0, 1, 0, 0, 3, 1, -20, 1, 4 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = 'p0071');
-- insert p0073 (D Tcaciov), points 2
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_11_CAS_BLD', '1b34d14e-fd95-4389-9a16-d7b11b0b9a65', 'p0073', 'BLD', TRUE, FALSE, FALSE, '16:08', 0, 7, 0, 6, 0, 1, 2, 2, 3, 3, 6, 4, 3, 2, 0, 3, 2, -8, 4, 2 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND player_id = 'p0073');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND team_id = 'CAS') <> 91 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_11_CAS_BLD CAS expected 91'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' AND team_id = 'BLD') <> 61 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_11_CAS_BLD BLD expected 61'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_CAS_BLD' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_10_11_AMB_WOL (AMB 69-87 WOL) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_AMB_WOL' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_10_11_AMB_WOL' AND p.player_id IN ('p0218', 'p0161', 'p0077') ON CONFLICT DO NOTHING;
-- reassign: V Secrieru p0077 -> p0161 (Vadim Secrieru), points 19
UPDATE public.player_game_stats SET player_id = 'p0161' WHERE game_id = 'g_2026_10_11_AMB_WOL' AND player_id = 'p0077' AND team_id = 'WOL' AND points = 19;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_AMB_WOL' AND player_id = 'p0161' AND points = 19) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_11_AMB_WOL p0077 -> p0161'; END IF; END $$;
-- insert p0218 (N Vishineacov), points 8
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_11_AMB_WOL', '61e9ec91-e12a-4091-a32c-d231b606e02a', 'p0218', 'AMB', FALSE, FALSE, FALSE, '30:10', 3, 10, 2, 9, 1, 1, 1, 2, 3, 4, 7, 3, 6, 4, 1, 3, 2, -9, 9, 8 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_AMB_WOL' AND player_id = 'p0218');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_AMB_WOL' AND team_id = 'AMB') <> 69 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_11_AMB_WOL AMB expected 69'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_AMB_WOL' AND team_id = 'WOL') <> 87 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_11_AMB_WOL WOL expected 87'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_AMB_WOL' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_10_11_GTM_DRO (GTM 65-70 DRO) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_GTM_DRO' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_10_11_GTM_DRO' AND p.player_id IN ('c9e3440b-6179-4bda-849c-9df0331c0c62', 'p0064') ON CONFLICT DO NOTHING;
-- reassign: I MITISOR p0064 -> c9e3440b-6179-4bda-849c-9df0331c0c62 (Ion Mitisov), points 17
UPDATE public.player_game_stats SET player_id = 'c9e3440b-6179-4bda-849c-9df0331c0c62' WHERE game_id = 'g_2026_10_11_GTM_DRO' AND player_id = 'p0064' AND team_id = 'DRO' AND points = 17;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_GTM_DRO' AND player_id = 'c9e3440b-6179-4bda-849c-9df0331c0c62' AND points = 17) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_11_GTM_DRO p0064 -> c9e3440b-6179-4bda-849c-9df0331c0c62'; END IF; END $$;
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_GTM_DRO' AND team_id = 'GTM') <> 65 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_11_GTM_DRO GTM expected 65'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_GTM_DRO' AND team_id = 'DRO') <> 70 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_11_GTM_DRO DRO expected 70'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_11_GTM_DRO' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== g_2026_10_18_GTM_HAI (GTM 63-59 HAI) =====
-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md).
BEGIN;
-- BEFORE: stored vs final score
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_GTM_HAI' GROUP BY team_id ORDER BY team_id;
INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = 'g_2026_10_18_GTM_HAI' AND p.player_id IN ('p0041', '9c211e0a-5b25-4695-b47c-4a05a0363d8b', 'p0145', 'p0053') ON CONFLICT DO NOTHING;
-- reassign: E Salcutan 9c211e0a-5b25-4695-b47c-4a05a0363d8b -> p0041 (Egor Salcutan), points 1
UPDATE public.player_game_stats SET player_id = 'p0041' WHERE game_id = 'g_2026_10_18_GTM_HAI' AND player_id = '9c211e0a-5b25-4695-b47c-4a05a0363d8b' AND team_id = 'HAI' AND points = 1;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_GTM_HAI' AND player_id = 'p0041' AND points = 1) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_18_GTM_HAI 9c211e0a-5b25-4695-b47c-4a05a0363d8b -> p0041'; END IF; END $$;
-- reassign: K Gorbuli p0053 -> 9c211e0a-5b25-4695-b47c-4a05a0363d8b (K Gorbuli), points 2
UPDATE public.player_game_stats SET player_id = '9c211e0a-5b25-4695-b47c-4a05a0363d8b' WHERE game_id = 'g_2026_10_18_GTM_HAI' AND player_id = 'p0053' AND team_id = 'HAI' AND points = 2;
DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_GTM_HAI' AND player_id = '9c211e0a-5b25-4695-b47c-4a05a0363d8b' AND points = 2) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: g_2026_10_18_GTM_HAI p0053 -> 9c211e0a-5b25-4695-b47c-4a05a0363d8b'; END IF; END $$;
-- insert p0145 (Alexandr Kalashnikov), points 10
INSERT INTO public.player_game_stats (game_id, source_job_id, player_id, team_id, is_starter, is_captain, dnp, minutes, fg_made, fg_att, two_made, two_att, three_made, three_att, ft_made, ft_att, reb_off, reb_def, reb_tot, assists, turnovers, steals, blocks, fouls_personal, fouls_drawn, plus_minus, efficiency, points) SELECT 'g_2026_10_18_GTM_HAI', '3019a13f-b32d-4069-929a-2a4c2708910a', 'p0145', 'HAI', TRUE, FALSE, FALSE, '35:05', 5, 10, 5, 10, 0, 0, 0, 0, 6, 4, 10, 1, 2, 0, 0, 4, 2, -2, 14, 10 WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_GTM_HAI' AND player_id = 'p0145');
-- AFTER: abort (and roll back everything) unless each team reconciles with the final score
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_GTM_HAI' AND team_id = 'GTM') <> 63 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_18_GTM_HAI GTM expected 63'; END IF; END $$;
DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_GTM_HAI' AND team_id = 'HAI') <> 59 THEN RAISE EXCEPTION 'reconciliation failed: g_2026_10_18_GTM_HAI HAI expected 59'; END IF; END $$;
SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = 'g_2026_10_18_GTM_HAI' GROUP BY team_id ORDER BY team_id;
COMMIT;  -- replace with ROLLBACK; to dry-run

-- ===== ROLLBACK GUIDANCE (after COMMIT) =====
-- For a game <GID>, restore only the rows this script touched:
--   BEGIN;
--   DELETE FROM public.player_game_stats WHERE game_id = '<GID>' AND player_id IN (<every player_id named in that game block: inserted ids, reassign sources and targets, updated ids>);
--   INSERT INTO public.player_game_stats SELECT (jsonb_populate_record(NULL::public.player_game_stats, to_jsonb(b))).* FROM public.player_game_stats_repair_backup b WHERE b.repair_tag = 'repair-2026-27' AND b.game_id = '<GID>';
--   COMMIT;
-- Inserted rows are removed by player_id (listed in each block's comments); reassigned/updated rows come back from the backup.
