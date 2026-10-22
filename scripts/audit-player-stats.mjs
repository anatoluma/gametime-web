// READ-ONLY audit of committed player_game_stats for one season. Issues SELECT queries only and
// writes report files; it never modifies the database and never executes the SQL it generates.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/audit-player-stats.mjs [season] [outDir]
//
// Defaults: season "2026/27", outDir "reconciliation/2026-27-integrity".
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { prepareCommit } from "../src/lib/commit-integrity.ts";
import { findResolution } from "../src/lib/roster-utils.ts";
import { resolveTeamId } from "../src/lib/team-codes.ts";

for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const SEASON = process.argv[2] ?? "2026/27";
const OUT = process.argv[3] ?? "reconciliation/2026-27-integrity";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STAT_COLS = [
  "is_starter", "is_captain", "dnp", "minutes", "fg_made", "fg_att", "two_made", "two_att", "three_made", "three_att",
  "ft_made", "ft_att", "reb_off", "reb_def", "reb_tot", "assists", "turnovers", "steals", "blocks",
  "fouls_personal", "fouls_drawn", "plus_minus", "efficiency", "points",
];
const NUMERIC_FP_COLS = STAT_COLS.filter((c) => !["is_starter", "is_captain", "dnp", "minutes"].includes(c));

const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data ?? [];
};
async function all(table, select, build = (q) => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await build(db.from(table).select(select)).range(from, from + 999), table);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

const games = await all("games", "game_id,home_team_id,away_team_id,home_score,away_score,tipoff", (q) => q.eq("season", SEASON).order("tipoff"));
const gameIds = games.map((g) => g.game_id);
const stored = await all("player_game_stats", "*", (q) => q.in("game_id", gameIds));
const details = await all("game_details", "game_id,source_job_id", (q) => q.in("game_id", gameIds));
const jobIds = [...new Set(details.map((d) => d.source_job_id).filter(Boolean))];
const jobs = jobIds.length ? await all("processing_jobs", "id,status,extraction_json,resolution_json", (q) => q.in("id", jobIds)) : [];
const roster = (await all("player_seasons", "player_id,team_id,jersey_number,is_active", (q) => q.eq("season", SEASON).eq("is_active", true)));
const players = await all("players", "player_id,first_name,last_name");

const P = Object.fromEntries(players.map((p) => [p.player_id, p]));
const nm = (id) => (P[id] ? `${P[id].first_name ?? ""} ${P[id].last_name ?? ""}`.trim() : id);
const rosterEntries = roster.map((r) => ({ ...r, first_name: P[r.player_id]?.first_name ?? null, last_name: P[r.player_id]?.last_name ?? null }));
const jobById = Object.fromEntries(jobs.map((j) => [j.id, j]));
const jobOfGame = Object.fromEntries(details.map((d) => [d.game_id, d.source_job_id]));

const num = (v) => (v == null ? null : Number(v));
const fp = (r) => NUMERIC_FP_COLS.map((c) => num(r[c])).join("|") + "|" + (r.minutes ?? "");
const diffCols = (a, b) => STAT_COLS.filter((c) => (typeof a[c] === "boolean" || typeof b[c] === "boolean" ? !!a[c] !== !!b[c] : (c === "minutes" ? (a[c] ?? null) !== (b[c] ?? null) : num(a[c]) !== num(b[c]))));
const sumPts = (rows) => rows.reduce((a, r) => a + (num(r.points) ?? 0), 0);

const lit = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : `'${String(v).replace(/'/g, "''")}'`);

const report = { season: SEASON, generated_at: new Date().toISOString(), games: [], sum_discrepancies: [], totals: {} };
const sqlSafe = [];
const sqlManual = [];

for (const g of games) {
  const entry = { game_id: g.game_id, home: g.home_team_id, away: g.away_team_id, score: [g.home_score, g.away_score], source_job_id: jobOfGame[g.game_id] ?? null, actions: [], notes: [] };
  const S = stored.filter((s) => s.game_id === g.game_id);
  const played = g.home_score != null && g.away_score != null;
  if (!played) { entry.notes.push("no final score yet (not committed)"); if (S.length === 0) continue; }

  for (const [t, sc] of [[g.home_team_id, g.home_score], [g.away_team_id, g.away_score]]) {
    if (!played) break;
    const rows = S.filter((s) => s.team_id === t);
    const sum = sumPts(rows);
    if (sum !== sc) report.sum_discrepancies.push({ game_id: g.game_id, team: t, score: sc, stored_points: sum, difference: sc - sum, stored_rows: rows.length });
  }

  const job = jobById[entry.source_job_id];
  const ex = job?.extraction_json;
  if (!ex?.players) { if (played) entry.notes.push("no source job/extraction: manual entry, only score sums audited"); report.games.push(entry); continue; }

  const resolutions = Array.isArray(job.resolution_json) ? job.resolution_json : [];
  const result = prepareCommit({
    gameId: g.game_id, jobId: job.id, season: SEASON, homeTeamId: g.home_team_id, awayTeamId: g.away_team_id,
    homeScore: g.home_score, awayScore: g.away_score, players: ex.players, resolutions, roster: rosterEntries, knownPlayers: players,
  });
  entry.integrity_errors = result.errors.map((e) => ({ code: e.code, team: e.team_id, jersey: e.jersey_number, name: e.extracted_name, player_id: e.player_id, message: e.message }));
  entry.integrity_warnings = result.warnings.map((e) => ({ code: e.code, message: e.message }));

  // Extracted identity per resolved player id, to label actions.
  const extractedBy = {};
  const resolvedIds = {};
  for (const p of ex.players) {
    if (p.dnp) continue;
    const team = resolveTeamId(p.team_code);
    const f = findResolution(resolutions, p.team_code, p.number, p.name);
    if (f.status === "found" && f.playerId) {
      extractedBy[f.playerId] = { name: p.name, number: p.number, team, method: f.legacy ? "legacy-name" : "exact", points: p.stats?.points };
      resolvedIds[f.playerId] = (resolvedIds[f.playerId] ?? 0) + 1;
    }
  }
  const blockedIds = new Set(result.errors.filter((e) => e.player_id).map((e) => e.player_id));
  const dupIds = new Set(Object.entries(resolvedIds).filter(([, n]) => n > 1).map(([id]) => id));
  const manual = (what) => entry.actions.push({ action: "manual review", confidence: "n/a", ...what });

  for (const e of result.errors) {
    if (["unresolved_player", "ambiguous_resolution", "not_in_season_roster", "wrong_team_in_season_roster", "duplicate_player", "unknown_team", "missing_points"].includes(e.code)) {
      manual({ team: e.team_id, extracted_name: e.extracted_name, jersey: e.jersey_number, player_id: e.player_id, explanation: `${e.code}: ${e.message}` });
    }
  }

  const E = result.rows.filter((r) => !blockedIds.has(r.player_id) && !dupIds.has(r.player_id));
  const used = new Set();
  const plan = [];

  for (const team of [g.home_team_id, g.away_team_id]) {
    const Et = E.filter((r) => r.team_id === team);
    const St = S.filter((s) => s.team_id === team);
    const claimed = new Set();
    const status = new Map();

    // 1. identical id + identical stats: unchanged.
    for (const e of Et) {
      const s = St.find((x) => x.player_id === e.player_id);
      if (s && diffCols(s, e).length === 0) { status.set(e.player_id, { kind: "unchanged", s }); claimed.add(s.player_id); }
    }
    // 2. wrong owner: stored row with identical stats under a different id, unique on both sides.
    const pending = Et.filter((e) => !status.has(e.player_id));
    const moves = [];
    for (const e of pending) {
      const cands = St.filter((s) => !claimed.has(s.player_id) && s.player_id !== e.player_id && fp(s) === fp(e) && !used.has(s.player_id));
      const twins = pending.filter((o) => fp(o) === fp(e));
      if (cands.length === 1 && twins.length === 1) { moves.push({ e, s: cands[0] }); claimed.add(cands[0].player_id); used.add(cands[0].player_id); status.set(e.player_id, { kind: "reassign", s: cands[0] }); }
    }
    // 3. same id, different stats: update; no stored row: insert.
    for (const e of pending) {
      if (status.has(e.player_id)) continue;
      const s = St.find((x) => x.player_id === e.player_id && !claimed.has(x.player_id));
      if (s) { status.set(e.player_id, { kind: "update", s }); claimed.add(s.player_id); } else status.set(e.player_id, { kind: "insert" });
    }
    // Order reassignments so a target id is free (cycles or occupied targets go to manual review).
    const movingFrom = new Set(moves.map((m) => m.s.player_id));
    const ordered = [];
    const remaining = [...moves];
    const occupied = new Set(St.map((s) => s.player_id));
    let progress = true;
    while (remaining.length && progress) {
      progress = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const m = remaining[i];
        if (!occupied.has(m.e.player_id)) { occupied.delete(m.s.player_id); occupied.add(m.e.player_id); ordered.push(m); remaining.splice(i, 1); progress = true; }
      }
    }
    const blockedMoves = new Set(remaining.map((m) => m.e.player_id));

    for (const e of Et) {
      const st = status.get(e.player_id);
      const x = extractedBy[e.player_id] ?? {};
      const base = { team, extracted_name: x.name ?? null, jersey: x.number ?? null, player_id: e.player_id, canonical_name: nm(e.player_id), extracted_stats: pick(e), resolution: x.method };
      const high = x.method === "exact" || x.method === "legacy-name";
      const conf = x.method === "exact" ? "high" : "medium";
      if (st.kind === "unchanged") { entry.actions.push({ ...base, action: "leave unchanged", confidence: "high", stored_stats: pick(st.s), explanation: "Stored row matches the extraction exactly." }); continue; }
      if (st.kind === "reassign") {
        if (blockedMoves.has(e.player_id)) { manual({ ...base, stored_stats: pick(st.s), explanation: `Stored row under ${st.s.player_id} (${nm(st.s.player_id)}) has this player's exact stats, but target id is occupied by an unrelated stored row.` }); continue; }
        entry.actions.push({ ...base, action: "reassign", from_player_id: st.s.player_id, from_name: nm(st.s.player_id), confidence: conf, stored_stats: pick(st.s), order: ordered.findIndex((m) => m.e.player_id === e.player_id), explanation: `Stats are stored under ${st.s.player_id} (${nm(st.s.player_id)}) but the resolved roster player is ${e.player_id} (${nm(e.player_id)}); the stat line is identical, so only player_id changes.` });
        plan.push({ type: "reassign", e, s: st.s, conf });
        continue;
      }
      if (st.kind === "update") {
        const cols = diffCols(st.s, e);
        entry.actions.push({ ...base, action: "update", confidence: conf, columns: cols, stored_stats: pick(st.s), explanation: `Stored row differs from extraction in: ${cols.join(", ")}.` });
        plan.push({ type: "update", e, s: st.s, cols, conf });
        continue;
      }
      entry.actions.push({ ...base, action: "insert", confidence: high ? conf : "low", stored_stats: null, explanation: "No stored row for this resolved player; extraction has the stat line." });
      plan.push({ type: "insert", e, conf });
    }

    for (const s of St) {
      if (claimed.has(s.player_id) || Et.some((e) => e.player_id === s.player_id)) continue;
      if (blockedIds.has(s.player_id) || dupIds.has(s.player_id) || true) {
        manual({ team, player_id: s.player_id, canonical_name: nm(s.player_id), stored_stats: pick(s), explanation: `Stored row for ${nm(s.player_id)} has no matching non-DNP player in the extraction (or its extracted counterpart is under manual review). Deletion is never proposed automatically.` });
      }
    }
  }

  // Predicted post-repair sums (safe actions applied, orphan rows left untouched).
  entry.post_repair = {};
  for (const team of [g.home_team_id, g.away_team_id]) {
    const sc = team === g.home_team_id ? g.home_score : g.away_score;
    const St = S.filter((s) => s.team_id === team);
    const byId = new Map(St.map((s) => [s.player_id, num(s.points) ?? 0]));
    for (const a of plan.filter((p) => p.e.team_id === team)) {
      if (a.type === "reassign") byId.delete(a.s.player_id);
      byId.set(a.e.player_id, a.e.points);
    }
    // Reassign targets must be written after the sources are removed, which the byId order above preserves.
    const sum = [...byId.values()].reduce((x, y) => x + y, 0);
    entry.post_repair[team] = { score: sc, predicted_sum: sum, reconciles: played && sum === sc };
  }
  entry.safe = plan.length > 0 && !entry.actions.some((a) => a.action === "manual review");
  entry.fully_automatic_possible = entry.safe && Object.values(entry.post_repair).every((p) => p.reconciles);
  report.games.push(entry);

  const safeActions = plan.filter((p) => p.conf !== "low");
  if (safeActions.length) (entry.fully_automatic_possible ? sqlSafe : sqlManual).push({ g, entry, plan: safeActions });
}

function pick(r) {
  return Object.fromEntries(STAT_COLS.filter((c) => c in r).map((c) => [c, r[c]]));
}

// ---------- SQL generation (never executed) ----------
function gameSql({ g, entry, plan }, gated) {
  const gid = lit(g.game_id);
  const L = [];
  L.push(`-- ===== ${g.game_id} (${g.home_team_id} ${g.home_score}-${g.away_score} ${g.away_team_id}) =====`);
  L.push(gated ? "-- Contains only actions whose identity is unambiguous, but the game also has items needing manual review (see repair-plan.md)." : "-- All actions are unambiguous and the game reconciles after repair.");
  L.push("BEGIN;");
  L.push(`-- BEFORE: stored vs final score`);
  L.push(`SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = ${gid} GROUP BY team_id ORDER BY team_id;`);
  const touched = [...new Set(plan.flatMap((a) => [a.e.player_id, a.s?.player_id].filter(Boolean)))];
  L.push(`INSERT INTO public.player_game_stats_repair_backup SELECT 'repair-2026-27'::text, now(), p.* FROM public.player_game_stats p WHERE p.game_id = ${gid} AND p.player_id IN (${touched.map(lit).join(", ") || "NULL"}) ON CONFLICT DO NOTHING;`);
  const reassigns = plan.filter((a) => a.type === "reassign").sort((a, b) => (entry.actions.find((x) => x.player_id === a.e.player_id)?.order ?? 0) - (entry.actions.find((x) => x.player_id === b.e.player_id)?.order ?? 0));
  for (const a of reassigns) {
    L.push(`-- reassign: ${entry.actions.find((x) => x.player_id === a.e.player_id)?.extracted_name ?? ""} ${a.s.player_id} -> ${a.e.player_id} (${nm(a.e.player_id)}), points ${a.e.points}`);
    L.push(`UPDATE public.player_game_stats SET player_id = ${lit(a.e.player_id)} WHERE game_id = ${gid} AND player_id = ${lit(a.s.player_id)} AND team_id = ${lit(a.e.team_id)} AND points = ${lit(num(a.s.points))};`);
    L.push(`DO $$ BEGIN IF (SELECT count(*) FROM public.player_game_stats WHERE game_id = ${gid} AND player_id = ${lit(a.e.player_id)} AND points = ${lit(a.e.points)}) <> 1 THEN RAISE EXCEPTION 'reassign precondition failed: ${g.game_id} ${a.s.player_id} -> ${a.e.player_id}'; END IF; END $$;`);
  }
  for (const a of plan.filter((p) => p.type === "update")) {
    L.push(`-- update ${a.e.player_id} (${nm(a.e.player_id)}): ${a.cols.join(", ")}`);
    L.push(`UPDATE public.player_game_stats SET ${a.cols.map((c) => `${c} = ${lit(a.e[c])}`).join(", ")} WHERE game_id = ${gid} AND player_id = ${lit(a.e.player_id)} AND team_id = ${lit(a.e.team_id)};`);
  }
  for (const a of plan.filter((p) => p.type === "insert")) {
    const cols = Object.keys(a.e);
    L.push(`-- insert ${a.e.player_id} (${nm(a.e.player_id)}), points ${a.e.points}`);
    L.push(`INSERT INTO public.player_game_stats (${cols.join(", ")}) SELECT ${cols.map((c) => lit(a.e[c])).join(", ")} WHERE NOT EXISTS (SELECT 1 FROM public.player_game_stats WHERE game_id = ${gid} AND player_id = ${lit(a.e.player_id)});`);
  }
  L.push("-- AFTER: abort (and roll back everything) unless each team reconciles with the final score");
  for (const [t, v] of Object.entries(entry.post_repair)) {
    if (v.score == null) continue;
    L.push(`DO $$ BEGIN IF (SELECT COALESCE(SUM(points),0) FROM public.player_game_stats WHERE game_id = ${gid} AND team_id = ${lit(t)}) <> ${v.score} THEN RAISE EXCEPTION 'reconciliation failed: ${g.game_id} ${t} expected ${v.score}'; END IF; END $$;`);
  }
  L.push(`SELECT team_id, SUM(points) AS stored_points, COUNT(*) AS rows FROM public.player_game_stats WHERE game_id = ${gid} GROUP BY team_id ORDER BY team_id;`);
  L.push("COMMIT;  -- replace with ROLLBACK; to dry-run");
  L.push("");
  return L.join("\n");
}

const header = (title, extra) => `-- ${title}\n-- NOT EXECUTED. Review every statement; run one game block at a time in a SQL console.\n-- Every block is a single transaction: any failed precondition or reconciliation check raises and rolls it back.\n-- Rollback after COMMIT: restore rows from public.player_game_stats_repair_backup (see rollback section at the end of this file).\n${extra}\n`;
const prelude = `-- One-time backup table (schema copy of player_game_stats + audit columns).\nCREATE TABLE IF NOT EXISTS public.player_game_stats_repair_backup AS\n  SELECT ''::text AS repair_tag, now() AS backed_up_at, p.* FROM public.player_game_stats p WHERE false;\n`;
const rollbackText = `\n-- ===== ROLLBACK GUIDANCE (after COMMIT) =====\n-- For a game <GID>, restore only the rows this script touched:\n--   BEGIN;\n--   DELETE FROM public.player_game_stats WHERE game_id = '<GID>' AND player_id IN (<every player_id named in that game block: inserted ids, reassign sources and targets, updated ids>);\n--   INSERT INTO public.player_game_stats SELECT (jsonb_populate_record(NULL::public.player_game_stats, to_jsonb(b))).* FROM public.player_game_stats_repair_backup b WHERE b.repair_tag = 'repair-2026-27' AND b.game_id = '<GID>';\n--   COMMIT;\n-- Inserted rows are removed by player_id (listed in each block's comments); reassigned/updated rows come back from the backup.\n`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "audit-report.json"), JSON.stringify(report, null, 2));
fs.writeFileSync(
  path.join(OUT, "repair-unambiguous.sql"),
  header("UNAMBIGUOUS repairs (identity proven by roster registration + identical stat line)", "") + prelude + "\n" + sqlSafe.map((x) => gameSql(x, false)).join("\n") + rollbackText
);
fs.writeFileSync(
  path.join(OUT, "repair-partial-games.sql"),
  header("PARTIAL repairs: unambiguous actions for games that ALSO have manual-review items (e.g. a missing roster registration). The in-block reconciliation guard still applies and rolls the block back if the game does not reconcile.", "-- Resolve the manual items in repair-plan.md (section 4) first or in addition.") + prelude + "\n" + sqlManual.map((x) => gameSql(x, true)).join("\n") + rollbackText
);

// ---------- Markdown plan ----------
const md = [];
md.push(`# ${SEASON} player-stats audit and repair plan (read-only)`, "", `Generated ${report.generated_at}. Nothing was modified; SQL files were not executed.`, "");
md.push("## 1. Team score vs stored player points", "", "| game_id | team | score | stored | difference | rows |", "|---|---|---|---|---|---|");
for (const d of report.sum_discrepancies) md.push(`| ${d.game_id} | ${d.team} | ${d.score} | ${d.stored_points} | ${d.difference} | ${d.stored_rows} |`);
if (!report.sum_discrepancies.length) md.push("| none | | | | | |");
const count = (k) => report.games.flatMap((g) => g.actions ?? []).filter((a) => a.action === k).length;
report.totals = { sum_discrepancies: report.sum_discrepancies.length, insert: count("insert"), reassign: count("reassign"), update: count("update"), unchanged: count("leave unchanged"), manual_review: count("manual review"), games_fully_automatic: report.games.filter((g) => g.fully_automatic_possible).length };
md.push("", "## 2. Totals", "", "```json", JSON.stringify(report.totals, null, 2), "```", "");
const sec = (title, filter) => {
  md.push(title, "");
  for (const g of report.games) {
    const acts = (g.actions ?? []).filter(filter);
    if (!acts.length) continue;
    md.push(`### ${g.game_id} (${g.home} ${g.score[0]}-${g.score[1]} ${g.away}), job ${g.source_job_id?.slice(0, 8)}`, "", "| team | extracted (#, name) | canonical player_id | action | confidence | extracted pts | stored pts | explanation |", "|---|---|---|---|---|---|---|---|");
    for (const a of acts) md.push(`| ${a.team ?? ""} | ${a.jersey ?? ""} ${a.extracted_name ?? ""} | ${a.player_id ?? ""} ${a.canonical_name ?? ""}${a.from_player_id ? ` (from ${a.from_player_id})` : ""} | ${a.action} | ${a.confidence} | ${a.extracted_stats?.points ?? ""} | ${a.stored_stats?.points ?? ""} | ${String(a.explanation).replace(/\|/g, "/")} |`);
    md.push("");
  }
};
sec("## 3. Unambiguous corrections (insert / reassign / update)", (a) => ["insert", "reassign", "update"].includes(a.action) && a.confidence !== "low");
sec("## 4. Requires manual identity confirmation", (a) => a.action === "manual review" || a.confidence === "low");
md.push("## 5. Post-repair prediction per game", "", "| game | team | score | predicted sum | reconciles |", "|---|---|---|---|---|");
for (const g of report.games) for (const [t, v] of Object.entries(g.post_repair ?? {})) if (g.actions?.some((a) => ["insert", "reassign", "update", "manual review"].includes(a.action))) md.push(`| ${g.game_id} | ${t} | ${v.score} | ${v.predicted_sum} | ${v.reconciles ? "yes" : "NO (needs manual items)"} |`);
md.push("", "## 6. Files", "", "- `repair-unambiguous.sql`: per-game transactions for games that fully reconcile after safe actions.", "- `repair-partial-games.sql`: safe actions for games that also need manual decisions (reconciliation guard will fail until manual items are done).", "- `audit-report.json`: complete machine-readable audit.", "");
fs.writeFileSync(path.join(OUT, "repair-plan.md"), md.join("\n"));

console.log(JSON.stringify(report.totals, null, 2));
console.log("wrote", OUT);
