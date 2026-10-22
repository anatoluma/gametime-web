import { createClient } from "@supabase/supabase-js";
import { resolveTeamId } from "@/lib/team-codes";
import { generateBannerAfterCommit, type AutoBannerResult } from "@/lib/banner/auto";
import { evaluateCommitReadiness } from "@/lib/commit-readiness";
import { CommitIntegrityError } from "@/lib/commit-integrity";
import { commitBoxScoreAtomic } from "@/lib/commit-rpc";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type JsonObject = Record<string, unknown>;

type JobRow = {
  id: string;
  status: string;
  season_id: number | null;
  competition_id: number | null;
  extraction_json: JsonObject | null;
  resolution_json: unknown;
};

type TeamSummaryLike = {
  team_code?: string | null;
  points_from_turnovers?: number | null;
  points_in_paint?: number | null;
  points_in_paint_att?: number | null;
  points_in_paint_pct?: number | null;
  second_chance_points?: number | null;
  fast_break_points?: number | null;
  bench_points?: number | null;
  biggest_lead?: number | null;
  biggest_lead_score?: string | null;
  biggest_scoring_run?: number | null;
  biggest_scoring_run_score?: string | null;
  lead_changes?: number | null;
  times_tied?: number | null;
  time_with_lead?: string | null;
};

type ExtractionPayload = {
  meta?: {
    game_number?: number | null;
    date?: string | null;
    start_time?: string | null;
    duration_minutes?: number | null;
    crew_chief?: string | null;
    umpires?: string[] | null;
  } | null;
  home_team?: {
    code?: string | null;
    score?: number | null;
  } | null;
  away_team?: {
    code?: string | null;
    score?: number | null;
  } | null;
  score_by_periods?: {
    home?: { intervals?: number[] | null } | null;
    away?: { intervals?: number[] | null } | null;
  } | null;
  team_summary?: TeamSummaryLike[] | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeCode(value: unknown): string | null {
  const str = toStringOrNull(value);
  return str ? str.trim().toUpperCase() : null;
}

function buildPlayedAt(date: string | null, time: string | null): string | null {
  if (!date) {
    return null;
  }
  const iso = time ? `${date}T${time}:00` : `${date}T00:00:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function computeSeasonFromTipoff(tipoffIso: string | null): string | null {
  if (!tipoffIso) {
    return null;
  }
  const d = new Date(tipoffIso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(-2);
  return `${startYear}/${endYearShort}`;
}

function generateGameId(tipoffIso: string | null, homeTeamId: string, awayTeamId: string): string {
  if (!tipoffIso) {
    return `g_unknown_${homeTeamId}_${awayTeamId}`;
  }
  const d = new Date(tipoffIso);
  if (Number.isNaN(d.getTime())) {
    return `g_unknown_${homeTeamId}_${awayTeamId}`;
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `g_${y}_${m}_${day}_${homeTeamId}_${awayTeamId}`;
}

function getVenueFromHomeTeam(homeTeamId: string): string {
  switch (homeTeamId.toUpperCase()) {
    case "BRI":
      return "Briceni";
    case "HAI":
      return "Blijnii Hutor";
    case "MET":
      return "Ribnita";
    case "DRO":
      return "Drochia";
    default:
      return "Edilitate";
  }
}

async function setCommitError(jobId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("processing_jobs")
    .update({
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function commitJob(jobId: string): Promise<{ game_id: string; banner: AutoBannerResult }> {
  try {
    const { data: job, error: jobError } = await supabaseAdmin
      .from("processing_jobs")
      .select("id, status, season_id, competition_id, extraction_json, resolution_json")
      .eq("id", jobId)
      .single<JobRow>();

    if (jobError || !job) {
      throw new Error(jobError?.message ?? `Processing job ${jobId} not found`);
    }

    if (job.status === "committed") {
      // Repeated request: the transaction already succeeded. Report the stored game; banner generation
      // is idempotent, so retrying it here also recovers from an earlier banner failure.
      const { data: detail } = await supabaseAdmin
        .from("game_details")
        .select("game_id")
        .eq("source_job_id", job.id)
        .limit(1)
        .maybeSingle<{ game_id: string }>();
      if (!detail?.game_id) {
        throw new Error(`Job ${jobId} is committed but no game references it`);
      }
      return { game_id: detail.game_id, banner: await generateBannerAfterCommit(job.id, detail.game_id) };
    }

    if (job.status !== "approved") {
      throw new Error(`Job ${jobId} must be approved before commit (current: ${job.status})`);
    }

    const extraction = (job.extraction_json ?? null) as ExtractionPayload | null;
    if (!extraction) {
      throw new Error("extraction_json is missing");
    }

    const homeCode = normalizeCode(extraction.home_team?.code);
    const awayCode = normalizeCode(extraction.away_team?.code);

    const homeTeamId = resolveTeamId(homeCode);
    const awayTeamId = resolveTeamId(awayCode);
    if (!homeTeamId || !awayTeamId) {
      throw new Error("Could not resolve home/away team IDs from extracted team codes");
    }

    const playedAt = buildPlayedAt(
      toStringOrNull(extraction.meta?.date),
      toStringOrNull(extraction.meta?.start_time)
    );

    // If a game with matching teams already exists on the same date, reuse its game_id
    // instead of generating a new one (avoids duplicate game rows on re-commit).
    const gameDate = playedAt ? playedAt.slice(0, 10) : null;
    let gameId = generateGameId(playedAt, homeTeamId, awayTeamId);

    if (gameDate) {
      const { data: existingGame } = await supabaseAdmin
        .from("games")
        .select("game_id")
        .eq("home_team_id", homeTeamId)
        .eq("away_team_id", awayTeamId)
        .gte("tipoff", `${gameDate}T00:00:00Z`)
        .lte("tipoff", `${gameDate}T23:59:59Z`)
        .maybeSingle<{ game_id: string }>();

      if (existingGame?.game_id) {
        gameId = existingGame.game_id;
      }
    }

    const fallbackSeason = String(job.season_id ?? "").trim();
    const season = computeSeasonFromTipoff(playedAt) ?? (fallbackSeason.length > 0 ? fallbackSeason : null);
    const venue = getVenueFromHomeTeam(homeTeamId);

    // Validate everything BEFORE any write: nothing below runs unless every non-DNP player is
    // uniquely resolved to this game's season roster and team points reconcile with the score.
    const readiness = await evaluateCommitReadiness(job, {
      season: computeSeasonFromTipoff(playedAt),
      gameId,
    });
    if (!readiness.result.ok) {
      throw new CommitIntegrityError(readiness.result.errors);
    }
    const statRows = readiness.result.rows;
    console.log(`[COMMIT] ${statRows.length} validated player rows for job ${jobId} (${readiness.season})`);

    const teamSummary = Array.isArray(extraction.team_summary) ? extraction.team_summary : [];
    const teamSummaryRows = teamSummary
      .map((summary) => ({
        game_id: gameId,
        source_job_id: job.id,
        team_id: resolveTeamId(normalizeCode(summary.team_code)),
        points_from_turnovers: toNumber(summary.points_from_turnovers),
        points_in_paint: toNumber(summary.points_in_paint),
        points_in_paint_att: toNumber(summary.points_in_paint_att),
        points_in_paint_pct: toNumber(summary.points_in_paint_pct),
        second_chance_points: toNumber(summary.second_chance_points),
        fast_break_points: toNumber(summary.fast_break_points),
        bench_points: toNumber(summary.bench_points),
        biggest_lead: toNumber(summary.biggest_lead),
        biggest_lead_score: toStringOrNull(summary.biggest_lead_score),
        biggest_scoring_run: toNumber(summary.biggest_scoring_run),
        biggest_scoring_run_score: toStringOrNull(summary.biggest_scoring_run_score),
        lead_changes: toNumber(summary.lead_changes),
        times_tied: toNumber(summary.times_tied),
        time_with_lead: toStringOrNull(summary.time_with_lead),
      }));

    // Never drop a summary silently: unknown or non-participating team codes block the commit.
    const badSummary = teamSummary.filter((summary, index) => {
      const id = teamSummaryRows[index].team_id;
      return id !== homeTeamId && id !== awayTeamId;
    });
    if (badSummary.length > 0) {
      throw new Error(
        `team_summary contains team code(s) ${badSummary
          .map((s) => `"${s.team_code ?? ""}"`)
          .join(", ")} that are not participants of this game (${homeTeamId} vs ${awayTeamId}). Correct the extraction; nothing was changed.`
      );
    }

    // Single database transaction: games, game_details, player_game_stats, game_team_summary and the
    // job's committed status are written together or not at all (COMMIT_BOX_SCORE_RPC.sql).
    const committed = await commitBoxScoreAtomic(
      (fn, args) => supabaseAdmin.rpc(fn, args),
      {
        jobId: job.id,
        game: {
          game_id: gameId,
          tipoff: playedAt,
          season,
          venue,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_score: toNumber(extraction.home_team?.score),
          away_score: toNumber(extraction.away_team?.score),
        },
        details: {
          game_id: gameId,
          game_number: toNumber(extraction.meta?.game_number),
          duration_minutes: toNumber(extraction.meta?.duration_minutes),
          crew_chief: toStringOrNull(extraction.meta?.crew_chief),
          umpires: Array.isArray(extraction.meta?.umpires) ? extraction.meta.umpires : [],
          score_intervals: {
            home: extraction.score_by_periods?.home?.intervals ?? [],
            away: extraction.score_by_periods?.away?.intervals ?? [],
          },
        },
        stats: statRows,
        teamSummary: teamSummaryRows,
      }
    );
    console.log(`[COMMIT] job ${jobId} committed atomically as ${committed.game_id} (${statRows.length} player rows)`);

    // Only after the transaction succeeded: banner generation. It never throws, so a banner problem
    // cannot invalidate the committed box score.
    const banner = await generateBannerAfterCommit(job.id, committed.game_id);
    return { game_id: committed.game_id, banner };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown commit error";
    await setCommitError(jobId, message);
    throw error;
  }
}
