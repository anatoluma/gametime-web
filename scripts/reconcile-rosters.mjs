#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const season = "2026/27";
const args = new Set(process.argv.slice(2));
const inputDir = path.resolve(process.env.ROSTER_INPUT_DIR || path.join(ROOT, "reconciliation", "input"));
const reportDir = path.resolve(process.env.ROSTER_REPORT_DIR || path.join(ROOT, "reconciliation", "reports"));
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, "reconciliation", "roster-decisions.json"), "utf8"));
const report = { mode: args.has("--apply") ? "apply" : "dry-run", season, inputs: [], playersToCreate: [], playersToRename: [], duplicateRecordsToMerge: [], membershipsToAdd: [], membershipsToDeactivate: [], currentTeamChanges: [], statisticsToReconnect: [], personalInformation: [], coachAssignments: [], identityResolutions: [], transliterationsForReview: [], unresolved: [], constraintViolations: [], skipped: [], beforeAfterCounts: [], assertions: [] };
let snapshotPlayers = [];

async function requireInput(name, required = true) {
  try {
    const contents = await fs.readFile(path.join(inputDir, name), "utf8");
    const rowCount = (contents.match(/\),\s*\(/g) || []).length + (contents.includes("VALUES") ? 1 : 0);
    report.inputs.push({ name, status: "found", bytes: contents.length, estimatedRows: rowCount });
    return contents;
  } catch {
    report.inputs.push({ name, status: "missing" });
    if (required) report.unresolved.push(`Missing required source: ${name}`);
    return null;
  }
}

function asciiOnly(value) { return /^[\x00-\x7F]*$/.test(value); }

function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function sameNameOrderIndependent(left, right) {
  const leftParts = normalizeName(left).split(" ").filter(Boolean);
  const rightParts = normalizeName(right).split(" ").filter(Boolean);
  return leftParts.length === rightParts.length && leftParts.every((part) => rightParts.includes(part));
}

function parseSqlLiteralRows(contents) {
  const columnMatch = contents.match(/INSERT INTO\s+(?:"[^"]+"\.)?"[^"]+"\s*\(([^)]+)\)\s*VALUES\s*/i);
  if (!columnMatch) return [];
  const columns = columnMatch[1].split(",").map((column) => column.trim().replace(/^"|"$/g, ""));
  const valuesText = contents.slice(columnMatch.index + columnMatch[0].length);
  const rows = [];
  let row = [];
  let value = "";
  let inString = false;
  let depth = 0;
  for (let index = 0; index < valuesText.length; index += 1) {
    const character = valuesText[index];
    const next = valuesText[index + 1];
    if (character === "'" && inString && next === "'") {
      value += "'";
      index += 1;
    } else if (character === "'") {
      inString = !inString;
    } else if (!inString && character === "(") {
      depth += 1;
      if (depth === 1) row = [];
    } else if (!inString && character === ")") {
      depth -= 1;
      if (depth === 0) {
        row.push(value.trim());
        if (row.length === columns.length) rows.push(Object.fromEntries(columns.map((column, rowIndex) => [column, row[rowIndex] === "NULL" ? null : row[rowIndex]])));
        row = [];
        value = "";
      }
    } else if (!inString && depth === 1 && character === ",") {
      row.push(value.trim());
      value = "";
    } else if (depth >= 1) {
      value += character;
    }
  }
  return rows;
}

function resolveSnapshotPlayer(name) {
  const normalized = normalizeName(name);
  const matches = snapshotPlayers.filter((player) => [
    `${player.first_name ?? ""} ${player.last_name ?? ""}`,
    `${player.last_name ?? ""} ${player.first_name ?? ""}`
  ].some((candidate) => normalizeName(candidate) === normalized));
  return { matches, id: matches.length === 1 ? matches[0].player_id : null };
}

function resolveAuthorizedAlias(name) {
  const aliases = manifest.teams.COM.temporaryAliases;
  const target = Object.entries(aliases).find(([, canonical]) => sameNameOrderIndependent(canonical, name))?.[0];
  if (!target) return null;
  const matches = snapshotPlayers.filter((player) => normalizeName(`${player.first_name ?? ""} ${player.last_name ?? ""}`) === normalizeName(target));
  return matches.length === 1 ? matches[0].player_id : null;
}

function inspectWorkbook(filePath, requiredSheets) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  for (const sheetName of requiredSheets) {
    if (!workbook.Sheets[sheetName]) report.constraintViolations.push(`Workbook is missing required sheet: ${sheetName}`);
  }
  const players = workbook.Sheets.Players ? XLSX.utils.sheet_to_json(workbook.Sheets.Players, { defval: null, range: 3 }) : [];
  const staff = workbook.Sheets.Staff ? XLSX.utils.sheet_to_json(workbook.Sheets.Staff, { defval: null, range: 3 }) : [];
  const review = workbook.Sheets["Review Needed"] ? XLSX.utils.sheet_to_json(workbook.Sheets["Review Needed"], { defval: null, range: 3 }) : [];
  report.inputs.push({ name: path.basename(filePath), status: "parsed", sheets: workbook.SheetNames, playerRows: players.length, staffRows: staff.length, reviewRows: review.length });
  for (const row of players) {
    const name = String(row["Player name (as printed/transcribed)"] ?? "").trim();
    if (name && !asciiOnly(name)) report.transliterationsForReview.push({ source: name, team: row.Team ?? null, proposed: null, status: "requires reviewed Latin transliteration" });
  }
  report.unresolved.push(...review.filter((row) => row.Player || row.Issue).map((row) => `Manual review required: ${row.Player ?? "unnamed player"} (${row.Issue ?? "unspecified issue"})`));
}

function inspectValidationWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const names = workbook.Sheets["Names to clarify"] ? XLSX.utils.sheet_to_json(workbook.Sheets["Names to clarify"], { defval: null, range: 3 }) : [];
  const memberships = workbook.Sheets["Roster membership"] ? XLSX.utils.sheet_to_json(workbook.Sheets["Roster membership"], { defval: null, range: 3 }) : [];
  report.inputs.push({ name: path.basename(filePath), status: "parsed", sheets: workbook.SheetNames, namesToClarifyRows: names.length, rosterMembershipRows: memberships.length });
  for (const row of names) {
    const canonicalName = String(row["Correct Latin name"] ?? "").trim();
    const decision = String(row["Same as candidate?"] ?? "").trim();
    if (row["Official/source name"] && canonicalName) {
      const resolved = resolveSnapshotPlayer(canonicalName);
      const authorizedAliasId = resolved.id ?? resolveAuthorizedAlias(canonicalName);
      report.transliterationsForReview.push({ source: row["Official/source name"], team: row.Team ?? null, proposed: canonicalName, sameAsCandidate: decision || null, resolvedPlayerId: authorizedAliasId });
      if (decision === "Yes" && !authorizedAliasId) report.constraintViolations.push(`Confirmed name does not resolve uniquely: ${canonicalName}`);
      if (decision === "Yes" && authorizedAliasId && row["Correct DB player ID"] && row["Correct DB player ID"] !== authorizedAliasId) report.constraintViolations.push(`Workbook ID disagrees with snapshot for ${canonicalName}: ${row["Correct DB player ID"]} vs ${authorizedAliasId}`);
      if (authorizedAliasId) report.identityResolutions.push({ source: row["Official/source name"], canonicalName, playerId: authorizedAliasId, method: resolved.id ? "exact canonical name" : "explicit reconciliation alias" });
      else if (decision === "Unclear" && canonicalName && !manifest.teams.COM.officialPlayers.some((officialName) => sameNameOrderIndependent(officialName, canonicalName))) report.unresolved.push(`Name does not uniquely match an existing player: ${canonicalName}`);
    }
    if (decision !== "Yes" && decision !== "No" && decision !== "Unclear") report.unresolved.push(`Identity decision required: ${row["Official/source name"] ?? "unnamed player"}`);
  }
  report.assertions.push(`${memberships.length} workbook roster memberships remain unchanged unless explicitly decided`);
}

function validateManifest() {
  assert.equal(manifest.season, season);
  assert.equal(manifest.teams.COM.officialPlayers.length, 19);
  assert.ok(manifest.doNotMerge.includes("Semen Goldstein"));
  assert.ok(manifest.doNotMerge.includes("Bogdan Gutu"));
  assert.ok(manifest.skip.includes("Anton (surname unclear)"));
  report.assertions.push("COM has exactly 19 official players");
  report.assertions.push("Confirmed separate identities are protected from merging");
  report.assertions.push("Unreadable identities are skipped");
  for (const [teamId, team] of Object.entries(manifest.teams)) {
    for (const name of [...(team.add || []), ...(team.officialPlayers || []), ...(team.transfersIn || [])]) {
      if (!asciiOnly(name)) report.constraintViolations.push(`Non-Latin canonical name: ${teamId}/${name}`);
      if (team.add?.includes(name) || team.officialPlayers?.includes(name)) report.playersToCreate.push({ teamId, season, name, status: "create-or-identify-from-source" });
      report.membershipsToAdd.push({ teamId, season, name });
    }
    for (const name of team.deactivate || []) report.membershipsToDeactivate.push({ teamId, season, name, reason: "confirmed removal" });
    for (const name of team.deactivateForTransfers || []) report.membershipsToDeactivate.push({ teamId, season, name, reason: "confirmed transfer" });
  }
  for (const item of manifest.merges) {
    if (manifest.doNotMerge.includes(item.duplicate) || manifest.doNotMerge.includes(item.canonical)) report.constraintViolations.push(`Merge conflicts with doNotMerge: ${item.duplicate} -> ${item.canonical}`);
    report.duplicateRecordsToMerge.push(item);
  }
  for (const [from, to, name] of [["BRI", "AMB", "Nichita Visneacov"], ["CAS", "AMB", "Ion Golovco"], ["BRI", "CAS", "Stanislav Goldstein"], ["AMB", "CN2", "Alic Tonciu"]]) report.currentTeamChanges.push({ from, to, name, season });
  for (const [from, to] of Object.entries(manifest.renames)) report.playersToRename.push({ from, to });
  report.statisticsToReconnect.push(...Object.entries(manifest.teams.COM.temporaryAliases).map(([from, to]) => ({ from, to, teamId: "COM", season })));
  report.skipped.push(...manifest.skip.map(source => ({ source, reason: "unreadable or incomplete identity" })));
  report.personalInformation.push({ status: "source-dependent", note: "Only complete source values are imported; unknowns remain NULL." });
  report.coachAssignments.push(...manifest.coaches.map(coach => ({ ...coach, season })));
  report.beforeAfterCounts.push(...Object.keys(manifest.teams).map(teamId => ({ teamId, before: "requires database snapshot", after: "requires database snapshot" })));
}

function sqlString(value) {
  return value === null || value === undefined ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;
}

function sqlArray(values) {
  return values.map(sqlString).join(", ");
}

function generateTransactionalSql() {
  const additions = [];
  const authorizedCanonicalNames = new Set(Object.values(manifest.teams.COM.temporaryAliases).map(normalizeName));
  for (const [teamId, team] of Object.entries(manifest.teams)) {
    for (const name of [...(team.add || []), ...(team.officialPlayers || []), ...(team.transfersIn || [])]) {
      if (teamId === "COM" && authorizedCanonicalNames.has(normalizeName(name))) continue;
      if (!additions.some((entry) => entry.teamId === teamId && sameNameOrderIndependent(entry.name, name))) additions.push({ teamId, name });
    }
  }
  const deactivations = Object.entries(manifest.teams).flatMap(([teamId, team]) => [
    ...(team.deactivate || []).map((name) => ({ teamId, name })),
    ...(team.deactivateForTransfers || []).map((name) => ({ teamId, name }))
  ]);
  const transfers = [
    ["BRI", "AMB", "Nichita Visneacov"],
    ["CAS", "AMB", "Ion Golovco"],
    ["BRI", "CAS", "Stanislav Goldstein"],
    ["BRI", "CN2", "Alic Tonciu"]
  ];
  const renames = Object.entries(manifest.renames);
  const merges = manifest.merges;
  const reconnects = Object.entries(manifest.teams.COM.temporaryAliases);
  return `-- Generated by scripts/reconcile-rosters.mjs after dry-run preflight.
-- Review this file in full. Execute only in Supabase SQL Editor.
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $reconcile$
DECLARE
  target RECORD;
  existing RECORD;
  canonical_id TEXT;
  duplicate_id TEXT;
  next_number INTEGER;
  target_jersey SMALLINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.seasons WHERE season = ${sqlString(season)}) THEN
    RAISE EXCEPTION 'Missing required season ${season}';
  END IF;
  IF (SELECT COUNT(*) FROM public.teams WHERE team_id IN (${sqlArray(Object.keys(manifest.teams))})) <> ${Object.keys(manifest.teams).length} THEN
    RAISE EXCEPTION 'One or more required team IDs are missing or duplicated';
  END IF;

  CREATE TEMP TABLE _recon_targets (
    team_id TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT NOT NULL,
    PRIMARY KEY (team_id, canonical_name)
  ) ON COMMIT DROP;

  INSERT INTO _recon_targets (team_id, canonical_name, first_name, last_name) VALUES
${additions.map(({ teamId, name }) => {
    const parts = name.split(" ");
    return `    (${sqlString(teamId)}, ${sqlString(name)}, ${sqlString(parts.slice(0, -1).join(" "))}, ${sqlString(parts.at(-1))})`;
  }).join(",\n")};

  FOR target IN SELECT * FROM _recon_targets LOOP
    SELECT p.* INTO existing
    FROM public.players p
    WHERE lower(concat_ws(' ', p.first_name, p.last_name)) = lower(target.canonical_name)
       OR lower(concat_ws(' ', p.last_name, p.first_name)) = lower(target.canonical_name)
       OR (lower(coalesce(p.first_name, '')) = lower(left(target.first_name, 1)) AND lower(p.last_name) = lower(target.last_name));
    IF FOUND THEN
      SELECT COUNT(*) INTO next_number
      FROM public.players p
      WHERE lower(concat_ws(' ', p.first_name, p.last_name)) = lower(target.canonical_name)
         OR lower(concat_ws(' ', p.last_name, p.first_name)) = lower(target.canonical_name)
         OR (lower(coalesce(p.first_name, '')) = lower(left(target.first_name, 1)) AND lower(p.last_name) = lower(target.last_name));
      IF next_number > 1 THEN RAISE EXCEPTION 'Ambiguous player identity: %', target.canonical_name; END IF;
      canonical_id := existing.player_id;
      UPDATE public.players SET first_name = target.first_name, last_name = target.last_name WHERE player_id = canonical_id;
    ELSE
      SELECT COALESCE(MAX((substring(player_id FROM 2))::INTEGER), 0) + 1 INTO next_number
      FROM public.players WHERE player_id ~ '^p[0-9]+$';
      canonical_id := 'p' || lpad(next_number::TEXT, 4, '0');
      INSERT INTO public.players (player_id, team_id, first_name, last_name, jersey_number, photo_url)
      VALUES (canonical_id, target.team_id, target.first_name, target.last_name, NULL, NULL);
    END IF;
    SELECT jersey_number INTO target_jersey FROM public.players WHERE player_id = canonical_id;
    IF target_jersey IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.player_seasons occupied
      WHERE occupied.season = ${sqlString(season)} AND occupied.team_id = target.team_id
        AND occupied.jersey_number = target_jersey AND occupied.is_active = true
        AND occupied.player_id <> canonical_id
    ) THEN
      target_jersey := NULL;
      UPDATE public.players SET jersey_number = NULL WHERE player_id = canonical_id;
    END IF;
    INSERT INTO public.player_seasons (player_id, season, team_id, jersey_number, is_active)
    VALUES (canonical_id, ${sqlString(season)}, target.team_id, target_jersey, true)
    ON CONFLICT (player_id, season) DO UPDATE SET team_id = EXCLUDED.team_id, jersey_number = EXCLUDED.jersey_number, is_active = true;
    UPDATE public.players SET team_id = target.team_id WHERE player_id = canonical_id;
  END LOOP;

  -- Explicitly reconnect the six abbreviated COM identities before any cleanup.
${reconnects.map(([from, to]) => { const parts = to.split(" "); return `  SELECT p.player_id INTO duplicate_id FROM public.players p WHERE (lower(coalesce(p.first_name, '')) = lower(split_part(${sqlString(from)}, ' ', 1)) OR lower(coalesce(p.first_name, '')) = lower(left(${sqlString(from)}, 1))) AND lower(p.last_name) = lower(split_part(${sqlString(from)}, ' ', 2));
  SELECT p.player_id INTO canonical_id FROM public.players p WHERE lower(concat_ws(' ', p.first_name, p.last_name)) = lower(${sqlString(to)}) OR lower(concat_ws(' ', p.last_name, p.first_name)) = lower(${sqlString(to)});
  IF duplicate_id IS NULL THEN RAISE EXCEPTION 'Missing temporary COM identity: %', ${sqlString(from)}; END IF;
  IF canonical_id IS NULL THEN
    canonical_id := duplicate_id;
    UPDATE public.players SET first_name = ${sqlString(parts.slice(0, -1).join(" "))}, last_name = ${sqlString(parts.at(-1))} WHERE player_id = canonical_id;
  END IF;
  IF duplicate_id <> canonical_id THEN UPDATE public.player_game_stats SET player_id = canonical_id WHERE player_id = duplicate_id; END IF;
  INSERT INTO public.player_seasons (player_id, season, team_id, is_active) VALUES (canonical_id, ${sqlString(season)}, 'COM', true) ON CONFLICT (player_id, season) DO UPDATE SET team_id = 'COM', is_active = true;
  UPDATE public.players SET team_id = 'COM' WHERE player_id = canonical_id;`; }).join("\n")}

  -- Preserve history while moving confirmed 2026/27 memberships.
${transfers.map(([, to, name]) => `  SELECT p.player_id INTO canonical_id FROM public.players p WHERE lower(concat_ws(' ', p.first_name, p.last_name)) = lower(${sqlString(name)}) OR lower(concat_ws(' ', p.last_name, p.first_name)) = lower(${sqlString(name)});
  IF canonical_id IS NULL THEN RAISE EXCEPTION 'Missing transfer player: %', ${sqlString(name)}; END IF;
  SELECT jersey_number INTO target_jersey FROM public.players WHERE player_id = canonical_id;
  IF target_jersey IS NOT NULL AND EXISTS (SELECT 1 FROM public.player_seasons occupied WHERE occupied.season = ${sqlString(season)} AND occupied.team_id = ${sqlString(to)} AND occupied.jersey_number = target_jersey AND occupied.is_active = true AND occupied.player_id <> canonical_id) THEN
    target_jersey := NULL;
    UPDATE public.players SET jersey_number = NULL WHERE player_id = canonical_id;
  END IF;
  UPDATE public.player_seasons SET team_id = ${sqlString(to)}, jersey_number = target_jersey, is_active = true WHERE player_id = canonical_id AND season = ${sqlString(season)};
  IF NOT FOUND THEN INSERT INTO public.player_seasons (player_id, season, team_id, jersey_number, is_active) VALUES (canonical_id, ${sqlString(season)}, ${sqlString(to)}, target_jersey, true); END IF;
  UPDATE public.players SET team_id = ${sqlString(to)} WHERE player_id = canonical_id;`).join("\n")}

  -- Apply canonical renames and then merge only explicitly confirmed duplicates.
${renames.map(([from, to]) => `  UPDATE public.players p SET first_name = split_part(${sqlString(to)}, ' ', 1), last_name = substring(${sqlString(to)} FROM position(' ' IN ${sqlString(to)}) + 1) WHERE lower(concat_ws(' ', p.first_name, p.last_name)) = lower(${sqlString(from)}) OR lower(concat_ws(' ', p.last_name, p.first_name)) = lower(${sqlString(from)});`).join("\n")}
${merges.map(({ duplicate, canonical }) => `  SELECT p.player_id INTO duplicate_id FROM public.players p WHERE lower(concat_ws(' ', p.first_name, p.last_name)) = lower(${sqlString(duplicate)}) OR lower(concat_ws(' ', p.last_name, p.first_name)) = lower(${sqlString(duplicate)});
  SELECT p.player_id INTO canonical_id FROM public.players p WHERE lower(concat_ws(' ', p.first_name, p.last_name)) = lower(${sqlString(canonical)}) OR lower(concat_ws(' ', p.last_name, p.first_name)) = lower(${sqlString(canonical)});
  IF duplicate_id IS NOT NULL AND canonical_id IS NOT NULL AND duplicate_id <> canonical_id THEN
    UPDATE public.player_game_stats SET player_id = canonical_id WHERE player_id = duplicate_id;
    UPDATE public.player_seasons ps SET player_id = canonical_id WHERE ps.player_id = duplicate_id AND NOT EXISTS (SELECT 1 FROM public.player_seasons keep WHERE keep.player_id = canonical_id AND keep.season = ps.season);
    UPDATE public.player_seasons SET is_active = false WHERE player_id = duplicate_id;
  END IF;`).join("\n")}

  -- Confirmed removals are inactive only; records and statistics remain.
${deactivations.map(({ teamId, name }) => `  UPDATE public.player_seasons ps SET is_active = false WHERE ps.season = ${sqlString(season)} AND ps.team_id = ${sqlString(teamId)} AND EXISTS (SELECT 1 FROM public.players p WHERE p.player_id = ps.player_id AND (lower(concat_ws(' ', p.first_name, p.last_name)) = lower(${sqlString(name)}) OR lower(concat_ws(' ', p.last_name, p.first_name)) = lower(${sqlString(name)}) OR lower(coalesce(p.first_name, '')) = lower(left(${sqlString(name)}, 1)) AND lower(p.last_name) = lower(split_part(${sqlString(name)}, ' ', 2))));`).join("\n")}

  INSERT INTO public.team_season_coaches (team_id, season, coach_name)
  VALUES ('BLD', ${sqlString(season)}, 'Artur Tonciu')
  ON CONFLICT (team_id, season) DO UPDATE SET coach_name = EXCLUDED.coach_name;
END;
$reconcile$;

DO $$
BEGIN
  IF EXISTS (SELECT player_id, season, team_id FROM public.player_seasons WHERE is_active GROUP BY player_id, season, team_id HAVING COUNT(*) > 1) THEN RAISE EXCEPTION 'Duplicate active membership detected'; END IF;
  IF EXISTS (SELECT pgs.game_id, pgs.player_id, pgs.team_id FROM public.player_game_stats pgs JOIN public.games g ON g.game_id = pgs.game_id WHERE g.season = ${sqlString(season)} GROUP BY pgs.game_id, pgs.player_id, pgs.team_id HAVING COUNT(*) > 1) THEN RAISE EXCEPTION 'Duplicate statistics rows detected'; END IF;
  IF EXISTS (SELECT pgs.player_id FROM public.player_game_stats pgs JOIN public.games g ON g.game_id = pgs.game_id WHERE g.season = ${sqlString(season)} AND NOT EXISTS (SELECT 1 FROM public.player_seasons ps WHERE ps.player_id = pgs.player_id AND ps.season = ${sqlString(season)} AND ps.team_id = pgs.team_id)) THEN RAISE EXCEPTION 'Statistics row has no corresponding season membership'; END IF;
END $$;

COMMIT;
`;
}

async function writeTransactionalSql() {
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(path.join(reportDir, "reconciliation-transaction.sql"), generateTransactionalSql(), "utf8");
}

const sqlInputs = await Promise.all([
  requireInput("players_rows.sql"),
  requireInput("player_seasons_rows.sql"),
  requireInput("player_game_stats_rows.sql"),
  requireInput("teams_rows.sql")
]);
if (sqlInputs[0]) snapshotPlayers = parseSqlLiteralRows(sqlInputs[0]);
if (sqlInputs[0]) report.assertions.push(`Parsed ${snapshotPlayers.length} players from players_rows.sql`);
await Promise.all([
  requireInput("LBM_2026-27_names_to_clarify(1).xlsx", false)
]);
const officialWorkbookPath = path.join(inputDir, "LBM_official_team_rosters_extracted.xlsx");
try {
  await fs.access(officialWorkbookPath);
  inspectWorkbook(officialWorkbookPath, ["Teams", "Players", "Staff", "Review Needed"]);
} catch {
  report.unresolved.push("Missing required source: LBM_official_team_rosters_extracted.xlsx");
}
try {
  await fs.access(path.join(inputDir, "LBM_2026-27_names_to_clarify(1).xlsx"));
  inspectValidationWorkbook(path.join(inputDir, "LBM_2026-27_names_to_clarify(1).xlsx"));
} catch {
  report.unresolved.push("Missing required source: LBM_2026-27_names_to_clarify(1).xlsx");
}
if (sqlInputs.some((contents) => contents === null)) report.unresolved.push("Database snapshot is incomplete; ID and duplicate validation cannot be trusted.");
else report.assertions.push("All four database snapshot exports are present");
validateManifest();
await writeTransactionalSql();
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(reportDir, "dry-run.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));

if (report.unresolved.length || report.constraintViolations.length) {
  console.error("Reconciliation is not applyable: resolve inputs and constraints first.");
  process.exitCode = 2;
} else if (args.has("--apply")) {
  console.error("Apply is gated: connect a reviewed generated transaction to a direct PostgreSQL client; no database write was performed.");
  process.exitCode = 3;
} else {
  console.error("Dry-run only. Nothing was written to the database.");
}