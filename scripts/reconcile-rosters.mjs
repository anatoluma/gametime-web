#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const season = "2026/27";
const args = new Set(process.argv.slice(2));
const inputDir = path.resolve(process.env.ROSTER_INPUT_DIR || path.join(ROOT, "reconciliation", "input"));
const reportDir = path.resolve(process.env.ROSTER_REPORT_DIR || path.join(ROOT, "reconciliation", "reports"));
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, "reconciliation", "roster-decisions.json"), "utf8"));
const report = { mode: args.has("--apply") ? "apply" : "dry-run", season, inputs: [], playersToCreate: [], playersToRename: [], duplicateRecordsToMerge: [], membershipsToAdd: [], membershipsToDeactivate: [], currentTeamChanges: [], statisticsToReconnect: [], personalInformation: [], coachAssignments: [], transliterationsForReview: [], unresolved: [], constraintViolations: [], skipped: [], beforeAfterCounts: [], assertions: [] };

async function requireInput(name) {
  try { await fs.access(path.join(inputDir, name)); report.inputs.push({ name, status: "found" }); }
  catch { report.inputs.push({ name, status: "missing" }); report.unresolved.push(`Missing required source: ${name}`); }
}

function asciiOnly(value) { return /^[\x00-\x7F]*$/.test(value); }

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

async function writeTransactionalSql() {
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(path.join(reportDir, "reconciliation-transaction.sql"), "-- Generated after source validation. Review dry-run.json before execution.\nBEGIN;\n\nCOMMIT;\n", "utf8");
}

await Promise.all(["players_rows (6).csv", "player_seasons_rows.csv", "player_season_stats_rows.csv", "official-2026-27-roster.json", "LBM_2026-27_names_to_clarify(1).xlsx"].map(requireInput));
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