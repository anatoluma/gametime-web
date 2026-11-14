import { createClient } from "@supabase/supabase-js";
import { resolveTeamId } from "@/lib/team-codes";
import { seasonFromDate, type ResolutionItemLike } from "@/lib/roster-utils";
import { fetchSeasonRoster, fetchUnregisteredReviewPlayers } from "@/lib/season-roster";
import {
  prepareCommit,
  type ExtractedPlayerLike,
  type IntegrityIssue,
  type IntegrityResult,
  type KnownPlayer,
  type RosterEntry,
} from "@/lib/commit-integrity";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function loadSeasonRoster(season: string, teamIds?: string[]): Promise<RosterEntry[]> {
  return fetchSeasonRoster(supabaseAdmin, season, teamIds);
}

export async function loadUnregisteredReviewPlayers(season: string, teamIds: string[]) {
  return fetchUnregisteredReviewPlayers(supabaseAdmin, season, teamIds);
}

type ExtractionShape = {
  meta?: { date?: string | null } | null;
  home_team?: { code?: string | null; score?: number | null } | null;
  away_team?: { code?: string | null; score?: number | null } | null;
  players?: ExtractedPlayerLike[] | null;
};

export type ReadinessJob = {
  id: string;
  extraction_json: unknown;
  resolution_json: unknown;
};

export type CommitReadiness = {
  season: string | null;
  result: IntegrityResult;
};

function blocked(message: string): CommitReadiness {
  const issue: IntegrityIssue = {
    severity: "error",
    code: "missing_game_data",
    team_id: null,
    jersey_number: null,
    extracted_name: null,
    player_id: null,
    message,
  };
  return { season: null, result: { ok: false, rows: [], errors: [issue], warnings: [], teamTotals: {} } };
}

function toScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Post-resolution validation: can this job be committed with the given resolutions?
 * Reads only. `resolutions` lets the approve route test admin overrides before saving them.
 */
export async function evaluateCommitReadiness(
  job: ReadinessJob,
  options: { season?: string | null; gameId?: string; resolutions?: ResolutionItemLike[] } = {}
): Promise<CommitReadiness> {
  const extraction = (job.extraction_json ?? null) as ExtractionShape | null;
  if (!extraction) return blocked("extraction_json is missing.");

  const homeTeamId = resolveTeamId(extraction.home_team?.code ?? null);
  const awayTeamId = resolveTeamId(extraction.away_team?.code ?? null);
  if (!homeTeamId || !awayTeamId) return blocked("Home/away team codes cannot be mapped to teams. Confirm the teams first.");

  const season = options.season ?? seasonFromDate(extraction.meta?.date);
  if (!season) return blocked("The extraction has no game date, so the season roster cannot be determined.");

  const resolutions = (options.resolutions ??
    (Array.isArray(job.resolution_json) ? (job.resolution_json as ResolutionItemLike[]) : [])) as ResolutionItemLike[];

  const roster = await loadSeasonRoster(season, [homeTeamId, awayTeamId]);

  const rosterIds = new Set(roster.map((r) => r.player_id));
  const missingIds = [
    ...new Set(
      resolutions
        .map((r) => (r.resolved_player_id == null ? "" : String(r.resolved_player_id)))
        .filter((id) => id !== "" && !rosterIds.has(id))
    ),
  ];
  let knownPlayers: KnownPlayer[] = [];
  if (missingIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("players")
      .select("player_id, first_name, last_name")
      .in("player_id", missingIds);
    knownPlayers = (data ?? []) as KnownPlayer[];
  }

  const result = prepareCommit({
    gameId: options.gameId ?? "preview",
    jobId: job.id,
    season,
    homeTeamId,
    awayTeamId,
    homeScore: toScore(extraction.home_team?.score),
    awayScore: toScore(extraction.away_team?.score),
    players: Array.isArray(extraction.players) ? extraction.players : [],
    resolutions,
    roster,
    knownPlayers,
  });
  return { season, result };
}
