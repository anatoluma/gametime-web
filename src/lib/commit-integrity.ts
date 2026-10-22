// Pre-commit integrity check. Pure: no database access, so it can be unit-tested and reused by the
// review page, the approve route, commitJob and the read-only audit script.
import { resolveTeamId } from "./team-codes.ts";
import { findResolution, normalizeJerseyNumber, type ResolutionItemLike } from "./roster-utils.ts";

export type RosterEntry = {
  player_id: string;
  team_id: string;
  jersey_number: number | null;
  first_name: string | null;
  last_name: string | null;
};

export type KnownPlayer = { player_id: string; first_name: string | null; last_name: string | null };

export type ExtractedPlayerLike = {
  team_code?: string | null;
  number?: unknown;
  name?: string | null;
  starter?: boolean | null;
  captain?: boolean | null;
  dnp?: boolean | null;
  stats?: Record<string, unknown> | null;
};

export type PlayerGameStatRow = {
  game_id: string;
  source_job_id: string;
  player_id: string;
  team_id: string;
  is_starter: boolean;
  is_captain: boolean;
  dnp: boolean;
  minutes: string | null;
  fg_made: number | null;
  fg_att: number | null;
  two_made: number | null;
  two_att: number | null;
  three_made: number | null;
  three_att: number | null;
  ft_made: number | null;
  ft_att: number | null;
  reb_off: number | null;
  reb_def: number | null;
  reb_tot: number | null;
  assists: number | null;
  turnovers: number | null;
  steals: number | null;
  blocks: number | null;
  fouls_personal: number | null;
  fouls_drawn: number | null;
  plus_minus: number | null;
  efficiency: number | null;
  points: number;
};

export type IntegrityCode =
  | "no_players"
  | "missing_game_data"
  | "unknown_team"
  | "team_not_in_game"
  | "unresolved_player"
  | "ambiguous_resolution"
  | "not_in_season_roster"
  | "wrong_team_in_season_roster"
  | "duplicate_player"
  | "missing_points"
  | "missing_score"
  | "team_points_mismatch"
  | "player_count_mismatch"
  | "jersey_mismatch"
  | "points_component_mismatch"
  | "dnp_with_stats";

export type IntegrityIssue = {
  severity: "error" | "warning";
  code: IntegrityCode;
  team_id: string | null;
  jersey_number: number | null;
  extracted_name: string | null;
  player_id: string | null;
  message: string;
};

export type IntegrityInput = {
  gameId: string;
  jobId: string;
  season: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  players: ExtractedPlayerLike[];
  resolutions: ResolutionItemLike[];
  roster: RosterEntry[];
  /** Optional canonical names used only to make messages actionable. */
  knownPlayers?: KnownPlayer[];
};

export type IntegrityResult = {
  ok: boolean;
  rows: PlayerGameStatRow[];
  errors: IntegrityIssue[];
  warnings: IntegrityIssue[];
  teamTotals: Record<string, { score: number | null; stored: number; expectedPlayers: number; preparedPlayers: number }>;
};

export function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toStr(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function label(player: ExtractedPlayerLike, teamId: string | null): string {
  const jersey = normalizeJerseyNumber(player.number);
  return `${teamId ?? player.team_code ?? "?"} ${jersey !== null ? `#${jersey} ` : ""}${player.name ?? "(no name)"}`;
}

function displayName(p: { first_name: string | null; last_name: string | null } | undefined): string | null {
  if (!p) return null;
  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return name || null;
}

export function prepareCommit(input: IntegrityInput): IntegrityResult {
  const errors: IntegrityIssue[] = [];
  const warnings: IntegrityIssue[] = [];
  const rows: PlayerGameStatRow[] = [];

  const rosterById = new Map(input.roster.map((entry) => [entry.player_id, entry]));
  const namesById = new Map<string, { first_name: string | null; last_name: string | null }>();
  for (const entry of input.roster) namesById.set(entry.player_id, entry);
  for (const known of input.knownPlayers ?? []) {
    if (!namesById.has(known.player_id)) namesById.set(known.player_id, known);
  }

  const issue = (
    severity: "error" | "warning",
    code: IntegrityCode,
    player: ExtractedPlayerLike | null,
    teamId: string | null,
    message: string,
    playerId: string | null = null
  ) => {
    (severity === "error" ? errors : warnings).push({
      severity,
      code,
      team_id: teamId,
      jersey_number: player ? normalizeJerseyNumber(player.number) : null,
      extracted_name: player?.name ?? null,
      player_id: playerId,
      message,
    });
  };

  const gameTeams = new Set([input.homeTeamId, input.awayTeamId]);
  const expectedByTeam = new Map<string, number>();
  const mappedBy = new Map<string, string[]>(); // player_id -> extracted labels

  if (input.players.length === 0) {
    issue("error", "no_players", null, null, "The extraction contains no player rows.");
  }

  for (const player of input.players) {
    const stats = player.stats ?? {};
    const teamId = resolveTeamId(toStr(player.team_code));

    if (player.dnp === true) {
      const dnpPoints = toNum(stats.points);
      if (dnpPoints !== null && dnpPoints > 0) {
        issue("warning", "dnp_with_stats", player, teamId, `${label(player, teamId)} is flagged DNP but has ${dnpPoints} points; the row is not stored.`);
      }
      continue;
    }

    if (!teamId) {
      issue("error", "unknown_team", player, null, `${label(player, null)}: team code "${player.team_code ?? ""}" cannot be mapped to a team.`);
      continue;
    }
    if (!gameTeams.has(teamId)) {
      issue("error", "team_not_in_game", player, teamId, `${label(player, teamId)}: team ${teamId} is neither home (${input.homeTeamId}) nor away (${input.awayTeamId}).`);
      continue;
    }
    expectedByTeam.set(teamId, (expectedByTeam.get(teamId) ?? 0) + 1);

    // --- identity -------------------------------------------------------
    const lookup = findResolution(input.resolutions, player.team_code, player.number, player.name);
    let playerId: string | null = null;
    if (lookup.status === "none") {
      issue("error", "unresolved_player", player, teamId, `${label(player, teamId)} has no player resolution. Resolve it in the review page.`);
    } else if (lookup.status === "ambiguous") {
      const names = lookup.items.map((i) => i.resolved_player_id).join(", ");
      issue("error", "ambiguous_resolution", player, teamId, `${label(player, teamId)} matches several different stored resolutions (${names}). Resolve it manually in the review page.`);
    } else if (lookup.playerId === null) {
      issue("error", "unresolved_player", player, teamId, `${label(player, teamId)} is not resolved to a player. Select the correct roster player (or register a new one) in the review page.`);
    } else {
      playerId = lookup.playerId;
    }

    // --- season roster membership --------------------------------------
    if (playerId) {
      const entry = rosterById.get(playerId);
      const known = displayName(namesById.get(playerId));
      const who = `${playerId}${known ? ` "${known}"` : ""}`;
      if (!entry) {
        issue(
          "error",
          "not_in_season_roster",
          player,
          teamId,
          `${label(player, teamId)} resolves to ${who}, who has no active ${input.season} roster registration. Register the player for ${teamId} in ${input.season} (admin players page) or pick another player.`,
          playerId
        );
        playerId = null;
      } else if (entry.team_id !== teamId) {
        issue(
          "error",
          "wrong_team_in_season_roster",
          player,
          teamId,
          `${label(player, teamId)} resolves to ${who}, who is registered with ${entry.team_id} (not ${teamId}) in ${input.season}. Confirm the transfer or pick another player; team assignments are not changed automatically.`,
          playerId
        );
        playerId = null;
      } else {
        const jersey = normalizeJerseyNumber(player.number);
        if (jersey !== null && entry.jersey_number !== null && entry.jersey_number !== jersey) {
          issue(
            "warning",
            "jersey_mismatch",
            player,
            teamId,
            `${label(player, teamId)} resolves to ${who}, registered as #${entry.jersey_number} in ${input.season}. Check for a jersey change or a misread number.`,
            playerId
          );
        }
      }
    }

    // --- required statistics -------------------------------------------
    const twoMade = toNum(stats.two_made);
    const threeMade = toNum(stats.three_made);
    const ftMade = toNum(stats.ft_made);
    const extractedPoints = toNum(stats.points);
    const computedPoints =
      twoMade !== null && threeMade !== null && ftMade !== null ? twoMade * 2 + threeMade * 3 + ftMade : null;
    const points = extractedPoints ?? computedPoints;
    if (points === null) {
      issue("error", "missing_points", player, teamId, `${label(player, teamId)} has no points and they cannot be computed from made shots. Correct the extraction.`, playerId);
    } else if (extractedPoints !== null && computedPoints !== null && extractedPoints !== computedPoints) {
      issue("warning", "points_component_mismatch", player, teamId, `${label(player, teamId)}: points ${extractedPoints} differ from made shots (${computedPoints}).`, playerId);
    }

    if (!playerId || points === null) continue;

    mappedBy.set(playerId, [...(mappedBy.get(playerId) ?? []), label(player, teamId)]);
    rows.push({
      game_id: input.gameId,
      source_job_id: input.jobId,
      player_id: playerId,
      team_id: teamId,
      is_starter: player.starter ?? false,
      is_captain: player.captain ?? false,
      dnp: false,
      minutes: toStr(stats.min),
      fg_made: toNum(stats.fg_made),
      fg_att: toNum(stats.fg_att),
      two_made: twoMade,
      two_att: toNum(stats.two_att),
      three_made: threeMade,
      three_att: toNum(stats.three_att),
      ft_made: ftMade,
      ft_att: toNum(stats.ft_att),
      reb_off: toNum(stats.reb_off),
      reb_def: toNum(stats.reb_def),
      reb_tot: toNum(stats.reb_tot),
      assists: toNum(stats.assists),
      turnovers: toNum(stats.turnovers),
      steals: toNum(stats.steals),
      blocks: toNum(stats.blocks),
      fouls_personal: toNum(stats.fouls_personal),
      fouls_drawn: toNum(stats.fouls_drawn),
      plus_minus: toNum(stats.plus_minus),
      efficiency: toNum(stats.efficiency),
      points,
    });
  }

  // --- duplicate player ids (never keep-last) ---------------------------
  for (const [playerId, labels] of mappedBy) {
    if (labels.length > 1) {
      const known = displayName(namesById.get(playerId));
      issue(
        "error",
        "duplicate_player",
        null,
        rosterById.get(playerId)?.team_id ?? null,
        `${labels.join(" and ")} are all mapped to ${playerId}${known ? ` "${known}"` : ""}. Each box-score row needs a different player; fix the mapping in the review page.`,
        playerId
      );
    }
  }

  // --- team reconciliation ----------------------------------------------
  const teamTotals: IntegrityResult["teamTotals"] = {};
  const scores: Array<[string, number | null]> = [
    [input.homeTeamId, input.homeScore],
    [input.awayTeamId, input.awayScore],
  ];
  for (const [teamId, score] of scores) {
    const teamRows = rows.filter((r) => r.team_id === teamId);
    const stored = teamRows.reduce((sum, r) => sum + r.points, 0);
    const expectedPlayers = expectedByTeam.get(teamId) ?? 0;
    teamTotals[teamId] = { score, stored, expectedPlayers, preparedPlayers: teamRows.length };

    if (score === null) {
      issue("error", "missing_score", null, teamId, `${teamId}: the extraction has no final score, so player points cannot be reconciled.`);
    } else if (stored !== score) {
      issue(
        "error",
        "team_points_mismatch",
        null,
        teamId,
        `${teamId}: final score ${score} but player points would sum to ${stored} (difference ${score - stored}).`
      );
    }
    if (teamRows.length !== expectedPlayers) {
      issue(
        "error",
        "player_count_mismatch",
        null,
        teamId,
        `${teamId}: ${expectedPlayers} non-DNP players extracted but only ${teamRows.length} rows can be stored.`
      );
    }
  }

  return { ok: errors.length === 0, rows, errors, warnings, teamTotals };
}

export class CommitIntegrityError extends Error {
  issues: IntegrityIssue[];
  constructor(issues: IntegrityIssue[]) {
    super(formatIntegrityErrors(issues));
    this.name = "CommitIntegrityError";
    this.issues = issues;
  }
}

export function formatIntegrityErrors(issues: IntegrityIssue[]): string {
  const errors = issues.filter((i) => i.severity === "error");
  return [
    `Commit blocked: ${errors.length} integrity problem${errors.length === 1 ? "" : "s"}. No stats were changed.`,
    ...errors.map((e) => `- ${e.message}`),
  ].join("\n");
}
