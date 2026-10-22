import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareCommit, formatIntegrityErrors } from "./commit-integrity.ts";
import {
  findResolution,
  normalizeJerseyNumber,
  normalizeNameKey,
  resolutionKey,
  seasonFromDate,
} from "./roster-utils.ts";

const SEASON = "2026/27";

const entry = (player_id, team_id, jersey_number, first_name, last_name) => ({
  player_id,
  team_id,
  jersey_number,
  first_name,
  last_name,
});

// 2026/27 HAI roster as in player_seasons (note Kalashnikov #24, Salcutan no number, Gorbuli #10).
const HAI_ROSTER = [
  entry("p0100", "HAI", 3, "Stanislav", "Basiul"),
  entry("p0043", "HAI", 4, "Ilia", "Vradii"),
  entry("p0141", "HAI", 8, "Vitalii", "Grankin"),
  entry("p0041", "HAI", null, "Egor", "Salcutan"),
  entry("gorb", "HAI", 10, "K", "Gorbuli"),
  entry("p0049", "HAI", 15, "Danila", "Iliin"),
  entry("p0145", "HAI", 24, "Alexandr", "Kalashnikov"),
  entry("p0052", "HAI", 27, "Constantin", "Jalo"),
  entry("p0053", "HAI", 35, "Oleg", "Greciuschin"),
];
const GTM_ROSTER = [entry("g1", "GTM", 0, "Alexandr", "Socolov"), entry("g2", "GTM", 2, "C", "Gherciu")];

const p = (team, number, name, points, extra = {}) => ({
  team_code: team,
  number,
  name,
  dnp: false,
  stats: { points, min: "10:00" },
  ...extra,
});

// Extraction as stored in the real job: jersey numbers are STRINGS.
const gtmHaiPlayers = () => [
  p("GTM", "0", "A Socolov", 40),
  p("GTM", "2", "C Gherciu", 23),
  p("HAI", "3", "S Bosiul", 11),
  p("HAI", "4", "I Vradii", 18),
  p("HAI", "8", "V Granchin", 10),
  p("HAI", "10", "E Salcutan", 1),
  p("HAI", "14", "A Kalasnicov", 10),
  p("HAI", "15", "D Ilin", 7),
  p("HAI", "27", "K Jalo", 0),
  p("HAI", "35", "K Gorbuli", 2),
  { team_code: "HAI", number: "9", name: "S Poiat", dnp: true, stats: {} },
];

// resolution_json as saved by the old resolver: number is null for every row.
const legacyResolution = (team, name, id) => ({
  team_code: team,
  number: null,
  extracted_name: name,
  resolved_player_id: id,
  method: "fuzzy",
  confirmed: false,
});
const gtmHaiResolutions = () => [
  legacyResolution("GTM", "A Socolov", "g1"),
  legacyResolution("GTM", "C Gherciu", "g2"),
  legacyResolution("HAI", "S Bosiul", "p0100"),
  legacyResolution("HAI", "I Vradii", "p0043"),
  legacyResolution("HAI", "V Granchin", "p0141"),
  legacyResolution("HAI", "E Salcutan", "p0041"),
  legacyResolution("HAI", "A Kalasnicov", "p0145"),
  legacyResolution("HAI", "D Ilin", "p0049"),
  legacyResolution("HAI", "K Jalo", "p0052"),
  legacyResolution("HAI", "K Gorbuli", "gorb"),
  legacyResolution("HAI", "S Poiat", "p0142"),
];

const input = (over = {}) => ({
  gameId: "g_2026_10_18_GTM_HAI",
  jobId: "job1",
  season: SEASON,
  homeTeamId: "GTM",
  awayTeamId: "HAI",
  homeScore: 63,
  awayScore: 59,
  players: gtmHaiPlayers(),
  resolutions: gtmHaiResolutions(),
  roster: [...GTM_ROSTER, ...HAI_ROSTER],
  ...over,
});

const codes = (issues) => issues.map((i) => i.code);

test("GTM vs HAI: Kalasnicov, Salcutan and Gorbuli land on the right players and totals reconcile", () => {
  const result = prepareCommit(input());
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 10);

  const byPlayer = Object.fromEntries(result.rows.map((r) => [r.player_id, r.points]));
  assert.equal(byPlayer.p0145, 10, "Kalasnicov (#14, registered #24) is stored under p0145");
  assert.equal(byPlayer.p0041, 1, "Salcutan keeps his own point");
  assert.equal(byPlayer.gorb, 2, "Gorbuli gets her 2 points");
  assert.equal(byPlayer.p0053, undefined, "Greciuschin (#35 in the global table) is not credited");
  assert.equal(byPlayer.p0052, 0, "Jalo with 0 points is stored");

  assert.equal(result.teamTotals.HAI.stored, 59);
  assert.equal(result.teamTotals.GTM.stored, 63);
  assert.ok(codes(result.warnings).includes("jersey_mismatch"), "jersey #14 vs registered #24 is a warning");
});

test("the old failure mode is now a blocking error: dropped Kalasnicov cannot reconcile", () => {
  const resolutions = gtmHaiResolutions().filter((r) => r.extracted_name !== "A Kalasnicov");
  const result = prepareCommit(input({ resolutions }));
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes("unresolved_player"));
  assert.ok(codes(result.errors).includes("team_points_mismatch"));
  assert.ok(codes(result.errors).includes("player_count_mismatch"));
  const mismatch = result.errors.find((e) => e.code === "team_points_mismatch");
  assert.match(mismatch.message, /final score 59 .* sum to 49 \(difference 10\)/);
  assert.match(formatIntegrityErrors(result.errors), /No stats were changed/);
});

test("string jersey numbers are normalized", () => {
  assert.equal(normalizeJerseyNumber("7"), 7);
  assert.equal(normalizeJerseyNumber(" #07 "), 7);
  assert.equal(normalizeJerseyNumber(0), 0);
  assert.equal(normalizeJerseyNumber("0"), 0);
  assert.equal(normalizeJerseyNumber("abc"), null);
  assert.equal(normalizeJerseyNumber(""), null);
  assert.equal(normalizeJerseyNumber(null), null);
  assert.equal(normalizeJerseyNumber(-1), null);
  assert.equal(resolutionKey("GTM", "7", "A. Socolov"), resolutionKey("gtm", 7, "a socolov"));
  assert.equal(normalizeNameKey("Ghérciu, C."), "gherciuc");
});

test("exact resolution by team + number + name beats legacy name matching", () => {
  const items = [
    { team_code: "CAS", number: 15, extracted_name: "S GOLDSTEIN", resolved_player_id: "a" },
    { team_code: "CAS", number: 16, extracted_name: "S GOLDSTEIN", resolved_player_id: "b" },
  ];
  const found15 = findResolution(items, "CAS", "15", "S Goldstein");
  const found16 = findResolution(items, "CAS", 16, "S Goldstein");
  assert.equal(found15.playerId, "a");
  assert.equal(found16.playerId, "b");
});

test("legacy null-number resolutions: unique name match is used, ambiguous is refused", () => {
  const unique = findResolution([legacyResolution("HAI", "K Jalo", "p0052")], "HAI", "27", "K Jalo");
  assert.equal(unique.status, "found");
  assert.equal(unique.playerId, "p0052");
  assert.equal(unique.legacy, true);

  const ambiguous = findResolution(
    [legacyResolution("CAS", "S GOLDSTEIN", "a"), legacyResolution("CAS", "S GOLDSTEIN", "b")],
    "CAS",
    "15",
    "S GOLDSTEIN"
  );
  assert.equal(ambiguous.status, "ambiguous");

  const wrongTeam = findResolution([legacyResolution("GTM", "K Jalo", "x")], "HAI", "27", "K Jalo");
  assert.equal(wrongTeam.status, "none");

  const differentNumber = findResolution(
    [{ team_code: "HAI", number: 5, extracted_name: "K Jalo", resolved_player_id: "x" }],
    "HAI",
    "27",
    "K Jalo"
  );
  assert.equal(differentNumber.status, "none");
});

test("ambiguous legacy resolution blocks the commit with an actionable error", () => {
  const resolutions = [
    ...gtmHaiResolutions().filter((r) => r.extracted_name !== "K Jalo"),
    legacyResolution("HAI", "K Jalo", "p0052"),
    legacyResolution("HAI", "K Jalo", "p0053"),
  ];
  const result = prepareCommit(input({ resolutions }));
  assert.equal(result.ok, false);
  assert.ok(codes(result.errors).includes("ambiguous_resolution"));
  assert.match(result.errors.find((e) => e.code === "ambiguous_resolution").message, /Resolve it manually/);
});

test("transferred player: registered with another team in the game's season is blocked, not reassigned", () => {
  // p0145 transferred to ADM for 2026/27.
  const roster = [...GTM_ROSTER, ...HAI_ROSTER.filter((r) => r.player_id !== "p0145"), entry("p0145", "ADM", 24, "Alexandr", "Kalashnikov")];
  const result = prepareCommit(input({ roster }));
  assert.equal(result.ok, false);
  const issue = result.errors.find((e) => e.code === "wrong_team_in_season_roster");
  assert.ok(issue);
  assert.equal(issue.player_id, "p0145");
  assert.match(issue.message, /registered with ADM \(not HAI\)/);
  assert.equal(result.rows.some((r) => r.player_id === "p0145"), false, "no row is invented for the wrong team");
});

test("transferred player: the season roster, not a stale global team, decides membership", () => {
  // Same player registered with HAI for this season passes even if another season had them elsewhere.
  const result = prepareCommit(input({ season: "2026/27" }));
  assert.equal(result.ok, true);
});

test("changed jersey number is a warning only; the resolved player is kept", () => {
  const result = prepareCommit(input());
  const warning = result.warnings.find((w) => w.code === "jersey_mismatch");
  assert.ok(warning);
  assert.equal(warning.player_id, "p0145");
  assert.match(warning.message, /registered as #24/);
  assert.equal(result.ok, true);
});

test("jersey number alone never picks a player: a colliding roster number is not used", () => {
  // No resolution for #35 K Gorbuli; the roster has Greciuschin at #35. It must NOT be guessed.
  const resolutions = gtmHaiResolutions().filter((r) => r.extracted_name !== "K Gorbuli");
  const result = prepareCommit(input({ resolutions }));
  assert.equal(result.ok, false);
  assert.equal(result.rows.some((r) => r.player_id === "p0053"), false);
  assert.ok(codes(result.errors).includes("unresolved_player"));
});

test("missing player_seasons registration is reported with the player name and never auto-created", () => {
  const roster = [...GTM_ROSTER, ...HAI_ROSTER.filter((r) => r.player_id !== "p0145")];
  const knownPlayers = [{ player_id: "p0145", first_name: "Alexandr", last_name: "Kalashnikov" }];
  const result = prepareCommit(input({ roster, knownPlayers }));
  assert.equal(result.ok, false);
  const issue = result.errors.find((e) => e.code === "not_in_season_roster");
  assert.ok(issue);
  assert.match(issue.message, /p0145 "Alexandr Kalashnikov"/);
  assert.match(issue.message, /no active 2026\/27 roster registration/);
  assert.match(issue.message, /Register the player for HAI in 2026\/27/);
  assert.equal(result.rows.some((r) => r.player_id === "p0145"), false);
});

test("duplicate player mappings are a blocking error, never keep-last", () => {
  const players = [p("CAS", "15", "S GOLDSTEIN", 8), p("CAS", "16", "S GOLDSTEIN", 2)];
  const result = prepareCommit({
    gameId: "g",
    jobId: "j",
    season: SEASON,
    homeTeamId: "CAS",
    awayTeamId: "ADM",
    homeScore: 10,
    awayScore: null,
    players,
    resolutions: [legacyResolution("CAS", "S GOLDSTEIN", "p0251"), legacyResolution("CAS", "S GOLDSTEIN", "p0251")],
    roster: [entry("p0251", "CAS", 15, "Semen", "Goldstein")],
  });
  assert.equal(result.ok, false);
  const dup = result.errors.find((e) => e.code === "duplicate_player");
  assert.ok(dup);
  assert.equal(dup.player_id, "p0251");
  assert.match(dup.message, /#15 S GOLDSTEIN and CAS #16 S GOLDSTEIN/);
  assert.equal(result.rows.filter((r) => r.player_id === "p0251").length, 2, "both rows are kept for the report, none is discarded");
});

test("unresolved player (admin chose 'new' or fuzzy found nothing) blocks the commit", () => {
  const resolutions = gtmHaiResolutions().map((r) => (r.extracted_name === "K Jalo" ? { ...r, resolved_player_id: null, method: "unresolved" } : r));
  const result = prepareCommit(input({ resolutions }));
  assert.equal(result.ok, false);
  const issue = result.errors.find((e) => e.code === "unresolved_player");
  assert.match(issue.message, /HAI #27 K Jalo/);
});

test("missing points block the commit; points can still be computed from made shots", () => {
  const noPoints = gtmHaiPlayers().map((pl) => (pl.name === "K Jalo" ? { ...pl, stats: { min: "04:55" } } : pl));
  const blocked = prepareCommit(input({ players: noPoints }));
  assert.equal(blocked.ok, false);
  assert.ok(codes(blocked.errors).includes("missing_points"));

  const computed = gtmHaiPlayers().map((pl) =>
    pl.name === "I Vradii" ? { ...pl, stats: { two_made: 6, three_made: 2, ft_made: 0, min: "37:38" } } : pl
  );
  const ok = prepareCommit(input({ players: computed }));
  assert.equal(ok.ok, true);
  assert.equal(ok.rows.find((r) => r.player_id === "p0043").points, 18);
});

test("DNP players are skipped without error and not counted", () => {
  const result = prepareCommit(input());
  assert.equal(result.rows.some((r) => r.player_id === "p0142"), false);
  assert.equal(result.teamTotals.HAI.expectedPlayers, 8);
});

test("final score mismatch and missing score are blocking", () => {
  assert.ok(codes(prepareCommit(input({ awayScore: 60 })).errors).includes("team_points_mismatch"));
  assert.ok(codes(prepareCommit(input({ homeScore: null })).errors).includes("missing_score"));
});

test("a team outside the game and an unknown team code are blocking", () => {
  const players = [...gtmHaiPlayers(), p("ADM", "5", "X Y", 2), p("ZZZ", "6", "Q R", 2)];
  const result = prepareCommit(input({ players }));
  assert.ok(codes(result.errors).includes("team_not_in_game"));
  assert.ok(codes(result.errors).includes("unknown_team"));
});

test("seasonFromDate follows the August season boundary", () => {
  assert.equal(seasonFromDate("2026-10-18"), "2026/27");
  assert.equal(seasonFromDate("2027-03-07"), "2026/27");
  assert.equal(seasonFromDate("2026-07-31"), "2025/26");
  assert.equal(seasonFromDate("2026-08-01T00:00:00Z"), "2026/27");
  assert.equal(seasonFromDate(null), null);
  assert.equal(seasonFromDate("nope"), null);
});
