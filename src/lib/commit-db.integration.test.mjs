import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { commitBoxScoreAtomic } from "./commit-rpc.ts";

// Real PostgreSQL (PGlite, WASM): the actual COMMIT_BOX_SCORE_RPC.sql runs against a schema that
// mirrors the production tables, so rollback behaviour is tested for real, not simulated.

const MIGRATION = fs.readFileSync(new URL("../../COMMIT_BOX_SCORE_RPC.sql", import.meta.url), "utf8");
const PROVENANCE_MIGRATION = fs.readFileSync(new URL("../../GAME_DATA_PROVENANCE.sql", import.meta.url), "utf8");
const MANUAL_MIGRATION = fs.readFileSync(new URL("../../MANUAL_GAME_RPC.sql", import.meta.url), "utf8");
const JOB = "11111111-1111-1111-1111-111111111111";
const OLD_JOB = "00000000-0000-0000-0000-000000000000";
const GAME = "g_2026_10_18_AAA_BBB";
const SEASON = "2026/27";

let db;

const BASE_SCHEMA = `
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE TABLE processing_jobs (id uuid PRIMARY KEY, status varchar(20) NOT NULL DEFAULT 'pending', season_id integer,
      competition_id integer, raw_file_path text NOT NULL DEFAULT 'x', extraction_json jsonb, validation_json jsonb, resolution_json jsonb,
      error_message text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      committed_at timestamptz, committed_by integer, home_team_id text, away_team_id text, banner_result jsonb);
    CREATE TABLE player_seasons (player_id text, season text, team_id text, jersey_number int, is_active boolean DEFAULT true,
      PRIMARY KEY (player_id, season));
    CREATE TABLE games (game_id text PRIMARY KEY, season text NOT NULL, tipoff timestamptz NOT NULL, venue text,
      home_team_id text NOT NULL, away_team_id text NOT NULL, home_score int, away_score int, scheduled_date date, round_number int,
      source_job_id uuid);
    CREATE TABLE game_details (game_id text PRIMARY KEY REFERENCES games(game_id), game_number int, duration_minutes int,
      crew_chief text, umpires text[], score_intervals jsonb, source_job_id uuid);
    CREATE TABLE player_game_stats (id bigserial PRIMARY KEY, game_id text NOT NULL, player_id text NOT NULL, team_id text NOT NULL, points int NOT NULL, source_job_id uuid,
      is_starter boolean, is_captain boolean, dnp boolean, minutes varchar(6),
      fg_made smallint, fg_att smallint, two_made smallint, two_att smallint, three_made smallint, three_att smallint,
      ft_made smallint, ft_att smallint, reb_off smallint, reb_def smallint, reb_tot smallint, assists smallint,
      turnovers smallint, steals smallint, blocks smallint, fouls_personal smallint, fouls_drawn smallint,
      plus_minus smallint, efficiency smallint, extra_metadata text);
    CREATE TABLE game_team_summary (id bigserial PRIMARY KEY, game_id text NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
      source_job_id uuid, team_id text NOT NULL, points_from_turnovers smallint, points_in_paint smallint,
      points_in_paint_att smallint, points_in_paint_pct decimal(4,1), second_chance_points smallint, fast_break_points smallint,
      bench_points smallint, biggest_lead smallint, biggest_lead_score varchar(20), biggest_scoring_run smallint,
      biggest_scoring_run_score varchar(20), lead_changes smallint, times_tied smallint, time_with_lead varchar(6),
      UNIQUE (game_id, team_id));
    CREATE OR REPLACE FUNCTION boom() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated failure'; END $$;
`;
// Production has no game_team_summary table: the same schema without it.
const NO_SUMMARY_SCHEMA = BASE_SCHEMA.replace(/CREATE TABLE game_team_summary[\s\S]*?UNIQUE \(game_id, team_id\)\);/, "");

before(async () => {
  db = new PGlite();
  await db.exec(BASE_SCHEMA);
  await db.exec(PROVENANCE_MIGRATION);
  await db.exec(MIGRATION);
  await db.exec(MANUAL_MIGRATION);
});

after(async () => {
  await db.close();
});

const stat = (player_id, team_id, points, extra = {}) => ({
  game_id: GAME, player_id, team_id, points, is_starter: true, is_captain: false, dnp: false, minutes: "10:00", ...extra,
});
const NEW_STATS = [stat("a", "AAA", 6), stat("b", "AAA", 6), stat("c", "BBB", 10)];
const game = (over = {}) => ({
  game_id: GAME, tipoff: "2026-10-18T18:00:00Z", season: SEASON, venue: "Edilitate",
  home_team_id: "AAA", away_team_id: "BBB", home_score: 12, away_score: 10, ...over,
});
const details = { game_id: GAME, game_number: 7, duration_minutes: 95, crew_chief: "X", umpires: ["U1", "U2"], score_intervals: { home: [10, 12], away: [5, 10] } };
const summary = [
  { team_id: "AAA", points_in_paint: 20, lead_changes: 3 },
  { team_id: "BBB", points_in_paint: 18, lead_changes: 3 },
];

const rpc = (over = {}) => ({
  jobId: JOB, game: game(), details, stats: NEW_STATS, teamSummary: summary, ...over,
});

// Calls the SQL function through the same wrapper commit.ts uses.
const caller = async (fn, args) => {
  try {
    const res = await db.query(
      `SELECT public.${fn}($1::uuid, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::int) AS r`,
      [args.p_job_id, JSON.stringify(args.p_game), JSON.stringify(args.p_details), JSON.stringify(args.p_stats), JSON.stringify(args.p_team_summary), args.p_expected_players]
    );
    return { data: res.rows[0].r, error: null };
  } catch (e) {
    return { data: null, error: { message: e.message, code: e.code } };
  }
};
const commit = (over) => commitBoxScoreAtomic(caller, rpc(over));
const manual = async (edit = false, gameInput = game(), stats = NEW_STATS) =>
  (await db.query("SELECT public.save_manual_game($1::jsonb, $2::jsonb, $3::boolean) AS r",
    [JSON.stringify(gameInput), JSON.stringify(stats), edit])).rows[0].r;

async function snapshot() {
  const q = async (sql) => (await db.query(sql)).rows;
  return {
    games: await q("SELECT * FROM games ORDER BY game_id"),
    details: await q("SELECT * FROM game_details ORDER BY game_id"),
    stats: await q("SELECT * FROM player_game_stats ORDER BY game_id, player_id"),
    summary: await q("SELECT game_id, team_id, points_in_paint, source_job_id FROM game_team_summary ORDER BY game_id, team_id"),
    jobs: await q("SELECT id, status, error_message FROM processing_jobs ORDER BY id"),
  };
}

// Previously committed version of the game, written by an earlier job.
beforeEach(async () => {
  await db.exec(`
    DROP TRIGGER IF EXISTS fail_details ON game_details; DROP TRIGGER IF EXISTS fail_stats ON player_game_stats;
    DROP TRIGGER IF EXISTS fail_summary ON game_team_summary; DROP TRIGGER IF EXISTS fail_job ON processing_jobs;
    DELETE FROM game_team_summary; DELETE FROM player_game_stats; DELETE FROM game_details; DELETE FROM games;
    DELETE FROM processing_jobs; DELETE FROM player_seasons;
    INSERT INTO processing_jobs (id, status) VALUES ('${OLD_JOB}', 'committed'), ('${JOB}', 'approved');
    INSERT INTO player_seasons (player_id, season, team_id) VALUES ('a','${SEASON}','AAA'),('b','${SEASON}','AAA'),('c','${SEASON}','BBB'),('z','${SEASON}','BBB');
    INSERT INTO games (game_id, tipoff, season, venue, home_team_id, away_team_id, home_score, away_score)
      VALUES ('${GAME}', '2026-10-18T18:00:00Z', '${SEASON}', 'OLD VENUE', 'AAA', 'BBB', 12, 10);
    UPDATE games SET scheduled_date = '2026-10-18', round_number = 4 WHERE game_id = '${GAME}';
    INSERT INTO game_details (game_id, game_number, source_job_id) VALUES ('${GAME}', 1, '${OLD_JOB}');
    INSERT INTO player_game_stats (game_id, player_id, team_id, source_job_id, points) VALUES
      ('${GAME}','a','AAA','${OLD_JOB}',5), ('${GAME}','b','AAA','${OLD_JOB}',7), ('${GAME}','c','BBB','${OLD_JOB}',10);
    INSERT INTO game_team_summary (game_id, team_id, source_job_id, points_in_paint) VALUES ('${GAME}','AAA','${OLD_JOB}',1);
  `);
});

async function assertRollsBack(run, pattern) {
  const before = await snapshot();
  await assert.rejects(run, pattern);
  assert.deepEqual(await snapshot(), before, "every table must be exactly as before the failed commit");
}

test("success writes games, details, stats, team summaries and job status together", async () => {
  const result = await commit();
  assert.deepEqual(result, { game_id: GAME, already_committed: false });
  const s = await snapshot();
  assert.equal(s.games[0].venue, "Edilitate");
  assert.equal(s.games[0].data_source, "box_score");
  assert.equal(s.games[0].source_job_id, JOB);
  assert.equal(s.games[0].round_number, 4, "schedule columns not owned by the import are preserved");
  assert.equal(String(s.games[0].scheduled_date).slice(0, 10) === "2026-10-18" || s.games[0].scheduled_date instanceof Date, true);
  assert.deepEqual(s.details[0].umpires, ["U1", "U2"]);
  assert.deepEqual(s.stats.map((r) => [r.player_id, r.points, r.source_job_id]), [["a", 6, JOB], ["b", 6, JOB], ["c", 10, JOB]]);
  assert.deepEqual(s.summary.map((r) => [r.team_id, r.points_in_paint]), [["AAA", 20], ["BBB", 18]], "summary is upserted, not duplicated");
  assert.equal(s.jobs.find((j) => j.id === JOB).status, "committed");
});

test("repeated and duplicate requests are idempotent", async () => {
  await commit();
  const afterFirst = await snapshot();
  const again = await commit();
  assert.deepEqual(again, { game_id: GAME, already_committed: true });
  assert.deepEqual(await snapshot(), afterFirst);
});

test("failure AFTER the games upsert (game_details write) rolls everything back", async () => {
  await db.exec(`CREATE TRIGGER fail_details BEFORE INSERT OR UPDATE ON game_details FOR EACH ROW EXECUTE FUNCTION boom()`);
  await assertRollsBack(() => commit(), /Commit rolled back.*simulated failure/);
  const s = await snapshot();
  assert.equal(s.games[0].venue, "OLD VENUE", "games upsert was undone");
  assert.equal(s.jobs.find((j) => j.id === JOB).status, "approved");
});

test("failure AFTER player-stat deletion keeps the previously committed stats", async () => {
  await db.exec(`CREATE TRIGGER fail_stats BEFORE INSERT ON player_game_stats FOR EACH ROW EXECUTE FUNCTION boom()`);
  await assertRollsBack(() => commit(), /Commit rolled back/);
  const s = await snapshot();
  assert.deepEqual(s.stats.map((r) => [r.player_id, r.points]), [["a", 5], ["b", 7], ["c", 10]], "old stats were not lost");
});

test("failure while writing team summaries rolls back stats and games", async () => {
  await db.exec(`CREATE TRIGGER fail_summary BEFORE INSERT OR UPDATE ON game_team_summary FOR EACH ROW EXECUTE FUNCTION boom()`);
  await assertRollsBack(() => commit(), /Commit rolled back/);
});

test("failure on the final job-status update rolls back everything before it", async () => {
  await db.exec(`CREATE TRIGGER fail_job BEFORE UPDATE ON processing_jobs FOR EACH ROW WHEN (NEW.status = 'committed') EXECUTE FUNCTION boom()`);
  await assertRollsBack(() => commit(), /Commit rolled back/);
  const s = await snapshot();
  assert.equal(s.games[0].venue, "OLD VENUE");
  assert.equal(s.stats.length, 3);
  assert.equal(s.stats[0].points, 5);
});

test("a retry after a failed commit succeeds and the job can still be committed", async () => {
  await db.exec(`CREATE TRIGGER fail_stats BEFORE INSERT ON player_game_stats FOR EACH ROW EXECUTE FUNCTION boom()`);
  await assert.rejects(() => commit());
  await db.exec(`DROP TRIGGER fail_stats ON player_game_stats`);
  assert.equal((await commit()).already_committed, false);
  assert.equal((await snapshot()).jobs.find((j) => j.id === JOB).status, "committed");
});

test("DB boundary rejects duplicate player_id without touching data", async () => {
  await assertRollsBack(() => commit({ stats: [stat("a", "AAA", 6), stat("a", "AAA", 6), stat("c", "BBB", 10)] }), /player a appears more than once/);
});

test("DB boundary rejects team points that do not reconcile with the final score", async () => {
  await assertRollsBack(() => commit({ stats: [stat("a", "AAA", 6), stat("c", "BBB", 10)] }), /AAA player points sum to 6 but the final score is 12/);
});

test("DB boundary rejects a player without an active roster registration for that team and season", async () => {
  await db.exec(`DELETE FROM player_seasons WHERE player_id = 'b'`);
  await assertRollsBack(() => commit(), /player b has no active 2026\/27 roster registration/);
  await db.exec(`INSERT INTO player_seasons VALUES ('b', '${SEASON}', 'BBB', 3, true)`);
  await assertRollsBack(() => commit(), /player b has no active/, "registered with the other team is also rejected");
  await db.exec(`UPDATE player_seasons SET team_id = 'AAA', is_active = false WHERE player_id = 'b'`);
  await assertRollsBack(() => commit(), /player b has no active/);
});

test("DB boundary rejects missing points, foreign game rows, unknown teams, empty stats and count mismatches", async () => {
  await assertRollsBack(() => commit({ stats: [stat("a", "AAA", null), stat("b", "AAA", 6), stat("c", "BBB", 10)] }), /needs game/);
  await assertRollsBack(() => commit({ stats: [stat("a", "AAA", 6, { game_id: "other" }), stat("b", "AAA", 6), stat("c", "BBB", 10)] }), /needs game/);
  await assertRollsBack(() => commit({ stats: [stat("a", "ZZZ", 6), stat("b", "AAA", 6), stat("c", "BBB", 10)] }), /team of this game/);
  await assertRollsBack(() => commit({ stats: [] }), /zero rows/);
  const mismatch = await caller("commit_box_score", {
    p_job_id: JOB, p_game: game(), p_details: details, p_stats: NEW_STATS, p_team_summary: [], p_expected_players: 4,
  });
  assert.match(mismatch.error.message, /expected 4 player rows but received 3/);
  assert.equal((await snapshot()).stats[0].points, 5);
});

test("DB boundary rejects missing scores/season and non-approved jobs", async () => {
  await assertRollsBack(() => commit({ game: game({ home_score: null }) }), /final scores are required/);
  await assertRollsBack(() => commit({ game: game({ season: null }) }), /final scores are required|season/);
  await assertRollsBack(() => commit({ game: game({ tipoff: null }) }), /tipoff/);
  await db.exec(`UPDATE processing_jobs SET status = 'pending' WHERE id = '${JOB}'`);
  await assertRollsBack(() => commit(), /must be approved/);
  await assertRollsBack(() => commit({ jobId: "22222222-2222-2222-2222-222222222222" }), /not found/);
});

test("a new game is created in the same transaction (no pre-existing rows)", async () => {
  await db.exec(`DELETE FROM game_team_summary; DELETE FROM player_game_stats; DELETE FROM game_details; DELETE FROM games;`);
  await commit();
  const s = await snapshot();
  assert.equal(s.games.length, 1);
  assert.equal(s.games[0].data_source, "box_score");
  assert.equal(s.games[0].source_job_id, JOB);
  assert.equal(s.stats.length, 3);
});

test("the provenance migration classifies existing games as unknown without guessing", async () => {
  await db.exec(PROVENANCE_MIGRATION);
  const legacy = (await db.query("SELECT data_source, source_job_id FROM games WHERE game_id = $1", [GAME])).rows[0];
  assert.deepEqual(legacy, { data_source: "unknown", source_job_id: null });
});

test("the provenance migration adds a missing games source_job_id column", async () => {
  const bare = new PGlite();
  try {
    await bare.exec(`
      CREATE TABLE processing_jobs (id uuid PRIMARY KEY);
      CREATE TABLE games (game_id text PRIMARY KEY);
      INSERT INTO games VALUES ('legacy');
    `);
    await bare.exec(PROVENANCE_MIGRATION);
    await bare.exec(PROVENANCE_MIGRATION);
    assert.deepEqual((await bare.query("SELECT data_source, source_job_id FROM games")).rows,
      [{ data_source: "unknown", source_job_id: null }]);
  } finally {
    await bare.close();
  }
});

test("new-game submissions reject completed and processed games without changing any data", async () => {
  for (const source of ["unknown", "manual", "box_score"]) {
    await db.query("UPDATE games SET data_source = $1 WHERE game_id = $2", [source, GAME]);
    const before = await snapshot();
    assert.equal((await manual()).status, "conflict");
    assert.deepEqual(await snapshot(), before);
  }
});

test("scheduled game completion is atomic, preserves schedule fields and cannot be submitted twice", async () => {
  await db.exec(`DELETE FROM game_team_summary; DELETE FROM player_game_stats; DELETE FROM game_details;
    UPDATE games SET home_score = NULL, away_score = NULL, source_job_id = NULL, data_source = 'unknown';`);
  assert.equal((await manual()).status, "ok");
  const saved = await snapshot();
  assert.equal(saved.games[0].data_source, "manual");
  assert.equal(saved.games[0].round_number, 4);
  assert.equal(saved.stats.length, 3);
  assert.equal((await manual()).status, "conflict");
  assert.deepEqual(await snapshot(), saved);
});

test("new mode requires both scores and does not change a scheduled game on failure", async () => {
  await db.exec(`DELETE FROM game_team_summary; DELETE FROM player_game_stats; DELETE FROM game_details;
    UPDATE games SET home_score = NULL, away_score = NULL, source_job_id = NULL, data_source = 'unknown';`);
  const before = await snapshot();
  await assert.rejects(() => manual(false, game({ away_score: null })), /both scores are required/);
  assert.deepEqual(await snapshot(), before);
});

test("new mode does not treat partially scored or previously sourced games as scheduled", async () => {
  await db.exec(`DELETE FROM game_team_summary; DELETE FROM player_game_stats; DELETE FROM game_details;
    UPDATE games SET home_score = NULL, away_score = NULL, data_source = 'unknown';`);
  for (const sql of [
    `UPDATE games SET home_score = 0`,
    `UPDATE games SET home_score = NULL, source_job_id = '${OLD_JOB}'`,
    `UPDATE games SET source_job_id = NULL, data_source = 'box_score'`,
    `UPDATE games SET data_source = 'unknown'; INSERT INTO game_details (game_id, source_job_id) VALUES ('${GAME}', '${OLD_JOB}')`,
    `DELETE FROM game_details; INSERT INTO player_game_stats (game_id, player_id, team_id, points) VALUES ('${GAME}', 'a', 'AAA', 1)`,
  ]) {
    await db.exec(sql);
    const before = await snapshot();
    assert.equal((await manual()).status, "conflict");
    assert.deepEqual(await snapshot(), before);
  }
});

test("edit requires an existing game and preserves box-score provenance and detailed stats", async () => {
  await db.exec(`UPDATE games SET data_source = 'box_score', source_job_id = '${OLD_JOB}';
    UPDATE player_game_stats SET assists = 7, is_captain = true, dnp = true, fg_made = 3, fg_att = 5,
      fouls_drawn = 4, extra_metadata = 'keep this' WHERE player_id = 'a';`);
  const missingBefore = await snapshot();
  assert.equal((await manual(true, game({ game_id: "missing" }))).status, "not_found");
  assert.deepEqual(await snapshot(), missingBefore);
  assert.equal((await manual(true, game({ data_source: "manual", source_job_id: null }), [
    { player_id: "a", team_id: "AAA", points: 11, assists: 9, source_job_id: JOB, extra_metadata: "overwrite" },
    { player_id: "z", team_id: "BBB", points: 10, source_job_id: JOB },
  ])).status, "ok");
  const saved = await snapshot();
  assert.equal(saved.games[0].data_source, "box_score");
  assert.equal(saved.games[0].source_job_id, OLD_JOB);
  const a = saved.stats.find((row) => row.player_id === "a");
  const oldA = missingBefore.stats.find((row) => row.player_id === "a");
  assert.equal(a.id, oldA.id);
  assert.equal(a.source_job_id, OLD_JOB);
  assert.equal(a.points, 11);
  assert.equal(a.assists, 9);
  assert.equal(a.is_captain, true);
  assert.equal(a.dnp, true);
  assert.equal(a.fg_made, 3);
  assert.equal(a.fg_att, 5);
  assert.equal(a.fouls_drawn, 4);
  assert.equal(a.extra_metadata, "keep this");
  assert.deepEqual(saved.stats.map((row) => row.player_id), ["a", "z"]);
  assert.equal(saved.stats.find((row) => row.player_id === "z").source_job_id, null);
});

test("editing an untouched scheduled game marks it manual only when both scores are present", async () => {
  await db.exec(`DELETE FROM game_team_summary; DELETE FROM player_game_stats; DELETE FROM game_details;
    UPDATE games SET home_score = NULL, away_score = NULL, source_job_id = NULL, data_source = 'unknown';`);
  assert.equal((await manual(true, game({ home_score: null, away_score: null }), [])).game.data_source, "unknown");
  assert.equal((await manual(true)).game.data_source, "manual");
  const saved = await snapshot();
  assert.equal(saved.games[0].source_job_id, null);
  assert.equal(saved.games[0].round_number, 4);
  assert.equal(saved.stats.length, 3);
});

test("editing an already completed unknown game keeps its unknown source", async () => {
  await db.exec(`UPDATE games SET source_job_id = NULL, data_source = 'unknown'`);
  assert.equal((await manual(true)).game.data_source, "unknown");
});

test("editing an unknown scoreless game with prior stats or a processing job keeps its source", async () => {
  await db.exec(`UPDATE games SET home_score = NULL, away_score = NULL, source_job_id = NULL, data_source = 'unknown'`);
  assert.equal((await manual(true)).game.data_source, "unknown");
  await db.exec(`DELETE FROM player_game_stats; UPDATE games SET home_score = NULL, away_score = NULL`);
  assert.equal((await manual(true)).game.data_source, "unknown");
});

test("manual creation rolls back game and stats on failure; retry is safe", async () => {
  await db.exec(`DELETE FROM game_team_summary; DELETE FROM player_game_stats; DELETE FROM game_details;
    UPDATE games SET home_score = NULL, away_score = NULL, data_source = 'unknown';
    CREATE TRIGGER fail_stats BEFORE INSERT ON player_game_stats FOR EACH ROW EXECUTE FUNCTION boom();`);
  const before = await snapshot();
  await assert.rejects(() => manual(), /simulated failure/);
  assert.deepEqual(await snapshot(), before);
  await db.exec(`DROP TRIGGER fail_stats ON player_game_stats`);
  assert.equal((await manual()).status, "ok");
});

test("competing new-game submissions produce one game and one set of stats", async () => {
  await db.exec(`DELETE FROM game_team_summary; DELETE FROM player_game_stats; DELETE FROM game_details; DELETE FROM games;`);
  const results = await Promise.all([manual(), manual()]);
  assert.deepEqual(results.map((result) => result.status).sort(), ["conflict", "ok"]);
  const saved = await snapshot();
  assert.equal(saved.games.length, 1);
  assert.equal(saved.stats.length, 3);
});

test("manual and processed commits serialize and leave exactly one processed set of stats", async () => {
  for (const processedFirst of [false, true]) {
    await db.exec(`DELETE FROM game_team_summary; DELETE FROM player_game_stats; DELETE FROM game_details;
      UPDATE processing_jobs SET status = 'approved' WHERE id = '${JOB}';
      UPDATE games SET home_score = NULL, away_score = NULL, data_source = 'unknown', source_job_id = NULL;`);
    const results = processedFirst
      ? await Promise.all([commit(), manual()])
      : await Promise.all([manual(), commit()]);
    assert.equal(results[processedFirst ? 1 : 0].status, processedFirst ? "conflict" : "ok");
    const saved = await snapshot();
    assert.equal(saved.games[0].data_source, "box_score");
    assert.equal(saved.games[0].source_job_id, JOB);
    assert.deepEqual(saved.stats.map((row) => row.source_job_id), [JOB, JOB, JOB]);
  }
});

test("manual edit rolls back both game and original stats when an update fails", async () => {
  await db.exec(`CREATE TRIGGER fail_stats BEFORE UPDATE ON player_game_stats FOR EACH ROW EXECUTE FUNCTION boom()`);
  const before = await snapshot();
  await assert.rejects(() => manual(true, game({ venue: "NEW VENUE" })), /simulated failure/);
  assert.deepEqual(await snapshot(), before);
});

test("manual game function is service-role only", async () => {
  const check = async (role) => (await db.query(
    `SELECT has_function_privilege($1, 'public.save_manual_game(jsonb,jsonb,boolean)', 'EXECUTE') AS ok`, [role]
  )).rows[0].ok;
  assert.equal(await check("anon"), false);
  assert.equal(await check("authenticated"), false);
  assert.equal(await check("service_role"), true);
});

test("manual game migration can be reapplied safely", async () => {
  await db.exec(MANUAL_MIGRATION);
  await db.exec(MANUAL_MIGRATION);
  assert.equal((await manual()).status, "conflict");
});

test("only service_role may execute the function; clients cannot call it directly", async () => {
  const check = async (role) =>
    (await db.query(`SELECT has_function_privilege('${role}', 'public.commit_box_score(uuid,jsonb,jsonb,jsonb,jsonb,integer)', 'EXECUTE') AS ok`)).rows[0].ok;
  assert.equal(await check("anon"), false);
  assert.equal(await check("authenticated"), false);
  assert.equal(await check("service_role"), true);
});

test("the migration is idempotent (re-running it is safe)", async () => {
  await db.exec(MIGRATION);
  await db.exec(MIGRATION);
  assert.equal((await commit()).already_committed, false);
});

test("wrapper: missing function and rollback errors are actionable", async () => {
  const missing = () => Promise.resolve({ data: null, error: { message: "Could not find the function public.commit_box_score", code: "PGRST202" } });
  await assert.rejects(() => commitBoxScoreAtomic(missing, rpc()), /COMMIT_BOX_SCORE_RPC\.sql.*Nothing was changed/);
  const noId = () => Promise.resolve({ data: {}, error: null });
  await assert.rejects(() => commitBoxScoreAtomic(noId, rpc()), /no game_id/);
});

test("team-summary codes: unknown or non-participating codes are rejected with an actionable error (table present)", async () => {
  await assertRollsBack(() => commit({ teamSummary: [{ team_id: "ZZZ", points_in_paint: 1 }] }), /team code ZZZ which is not a participant of g_2026_10_18_AAA_BBB \(AAA vs BBB\)/);
  await assertRollsBack(() => commit({ teamSummary: [{ team_id: null, points_in_paint: 1 }] }), /team code <missing>/);
  await assertRollsBack(() => commit({ teamSummary: [{ team_id: "AAA" }, { team_id: "AAA" }] }), /lists team AAA more than once/);
  await assertRollsBack(() => commit({ teamSummary: { team_id: "AAA" } }), /must be an array/);
});

test("game_team_summary table ABSENT (as in production): commit succeeds, summaries are skipped, codes still validated", async () => {
  const bare = new PGlite();
  await bare.exec(NO_SUMMARY_SCHEMA);
  await bare.exec(PROVENANCE_MIGRATION);
  await bare.exec(MIGRATION);
  assert.equal((await bare.query("SELECT to_regclass('public.game_team_summary') AS t")).rows[0].t, null);
  await bare.exec(`
    INSERT INTO processing_jobs (id, status) VALUES ('${OLD_JOB}', 'committed'), ('${JOB}', 'approved');
    INSERT INTO player_seasons (player_id, season, team_id) VALUES ('a','${SEASON}','AAA'),('b','${SEASON}','AAA'),('c','${SEASON}','BBB');
    INSERT INTO games (game_id, tipoff, season, venue, home_team_id, away_team_id, home_score, away_score)
      VALUES ('${GAME}', '2026-10-18T18:00:00Z', '${SEASON}', 'OLD VENUE', 'AAA', 'BBB', 12, 10);
    INSERT INTO game_details (game_id, game_number, source_job_id) VALUES ('${GAME}', 1, '${OLD_JOB}');
    INSERT INTO player_game_stats (game_id, player_id, team_id, source_job_id, points) VALUES
      ('${GAME}','a','AAA','${OLD_JOB}',5), ('${GAME}','b','AAA','${OLD_JOB}',7), ('${GAME}','c','BBB','${OLD_JOB}',10);
  `);
  const call = async (summary) => {
    try {
      const r = await bare.query(`SELECT public.commit_box_score($1::uuid,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6::int) AS r`,
        [JOB, JSON.stringify(game()), JSON.stringify(details), JSON.stringify(NEW_STATS), JSON.stringify(summary), 3]);
      return { data: r.rows[0].r, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  };
  // Invalid code is still rejected and nothing changes.
  const bad = await call([{ team_id: "ZZZ" }]);
  assert.match(bad.error.message, /team code ZZZ which is not a participant/);
  assert.equal((await bare.query("SELECT points FROM player_game_stats WHERE player_id='a'")).rows[0].points, 5);
  assert.equal((await bare.query("SELECT status FROM processing_jobs WHERE id=$1", [JOB])).rows[0].status, "approved");
  // Valid summary rows are accepted but not stored (no table); core data commits transactionally.
  const ok = await call([{ team_id: "AAA", points_in_paint: 20 }, { team_id: "BBB", points_in_paint: 18 }]);
  assert.equal(ok.error, null, ok.error?.message);
  assert.deepEqual(ok.data, { game_id: GAME, already_committed: false, player_rows: 3 });
  assert.deepEqual((await bare.query("SELECT player_id, points FROM player_game_stats ORDER BY player_id")).rows.map((r) => [r.player_id, r.points]), [["a", 6], ["b", 6], ["c", 10]]);
  assert.equal((await bare.query("SELECT status FROM processing_jobs WHERE id=$1", [JOB])).rows[0].status, "committed");
  assert.equal((await bare.query("SELECT to_regclass('public.game_team_summary') AS t")).rows[0].t, null, "the optional table is never created");
  await bare.close();
});
