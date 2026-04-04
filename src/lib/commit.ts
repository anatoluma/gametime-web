import { createClient } from "@supabase/supabase-js";

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

type ResolutionItem = {
  team_code?: string;
  number?: number;
  extracted_name?: string;
  resolved_player_id?: number | string;
};

type TeamLike = {
  team_id?: string | null;
  code?: string | null;
  team_code?: string | null;
  abbreviation?: string | null;
  short_code?: string | null;
};

type ExistingPlayer = {
  player_id: string;
  team_id: string;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number | null;
};

type PlayerGameStatInsert = {
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
  points: number | null;
};

type PlayerLike = {
  team_code?: string | null;
  number?: number | null;
  name?: string | null;
  starter?: boolean | null;
  captain?: boolean | null;
  dnp?: boolean | null;
  stats?: Record<string, unknown> | null;
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
  players?: PlayerLike[] | null;
  team_summary?: TeamSummaryLike[] | null;
};

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function resolutionKey(teamCode: string | null, number: number | null, name: string | null): string {
  return `${teamCode ?? ""}|${number ?? ""}|${(name ?? "").trim().toLowerCase()}`;
}

function getTeamCodes(team: TeamLike): string[] {
  const candidates = [team.team_code, team.code, team.abbreviation, team.short_code, team.team_id];
  return candidates
    .map((value) => normalizeCode(value))
    .filter((v): v is string => v !== null);
}

function normalizeName(value: string | null): string {
  if (!value) {
    return "";
  }
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function buildNameCandidates(player: ExistingPlayer): string[] {
  const first = normalizeName(player.first_name);
  const last = normalizeName(player.last_name);
  const full = normalizeName(`${player.first_name ?? ""}${player.last_name ?? ""}`);
  const initialLast = first.length > 0 ? `${first[0]}${last}` : "";
  return [full, `${first}${last}`, initialLast, last].filter((v) => v.length > 0);
}

function findPlayerId(
  player: PlayerLike,
  teamId: string,
  teamPlayers: ExistingPlayer[],
  resolvedPlayerId: string | null
): string | null {
  if (resolvedPlayerId) {
    const exists = teamPlayers.some((p) => p.player_id === resolvedPlayerId);
    if (exists) {
      return resolvedPlayerId;
    }
  }

  const number = toNumber(player.number);
  if (number !== null) {
    const byNumber = teamPlayers.find((p) => p.team_id === teamId && p.jersey_number === number);
    if (byNumber) {
      return byNumber.player_id;
    }
  }

  const extracted = normalizeName(toStringOrNull(player.name));
  if (extracted) {
    const byName = teamPlayers.find((p) => buildNameCandidates(p).some((n) => n === extracted));
    if (byName) {
      return byName.player_id;
    }
  }

  return null;
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

export async function commitJob(jobId: string): Promise<{ game_id: string }> {
  try {
    const { data: job, error: jobError } = await supabaseAdmin
      .from("processing_jobs")
      .select("id, status, season_id, competition_id, extraction_json, resolution_json")
      .eq("id", jobId)
      .single<JobRow>();

    if (jobError || !job) {
      throw new Error(jobError?.message ?? `Processing job ${jobId} not found`);
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

    const { data: teamsData, error: teamsError } = await supabaseAdmin.from("teams").select("*");
    if (teamsError) {
      throw new Error(`Failed to load teams: ${teamsError.message}`);
    }

    const teams = (teamsData ?? []) as TeamLike[];
    const teamIdByCode = new Map<string, string>();
    for (const team of teams) {
      const teamId = team.team_id ?? null;
      if (teamId === null) {
        continue;
      }
      for (const code of getTeamCodes(team)) {
        teamIdByCode.set(code, teamId);
      }
    }

    const homeTeamId = homeCode ? teamIdByCode.get(homeCode) ?? null : null;
    const awayTeamId = awayCode ? teamIdByCode.get(awayCode) ?? null : null;
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

    // Core fields — always present in the original schema
    const { data: game, error: gameUpsertError } = await supabaseAdmin
      .from("games")
      .upsert({
        game_id: gameId,
        tipoff: playedAt,
        season,
        venue,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_score: toNumber(extraction.home_team?.score),
        away_score: toNumber(extraction.away_team?.score),
      }, { onConflict: "game_id" })
      .select("game_id")
      .single<{ game_id: string }>();

    if (gameUpsertError || !game) {
      throw new Error(gameUpsertError?.message ?? "Failed to upsert game");
    }

    // Extended OCR metadata — only available after BOX_SCORE_OCR_MIGRATION.sql has been run.
    // Soft-fail so commit works on the original schema too.
    await supabaseAdmin
      .from("games")
      .update({
        source_job_id: job.id,
        competition_id: job.competition_id,
        game_number: toNumber(extraction.meta?.game_number),
        duration_minutes: toNumber(extraction.meta?.duration_minutes),
        crew_chief: toStringOrNull(extraction.meta?.crew_chief),
        umpires: Array.isArray(extraction.meta?.umpires) ? extraction.meta.umpires : [],
        score_intervals: {
          home: Array.isArray(extraction.score_by_periods?.home?.intervals)
            ? extraction.score_by_periods!.home!.intervals
            : [],
          away: Array.isArray(extraction.score_by_periods?.away?.intervals)
            ? extraction.score_by_periods!.away!.intervals
            : [],
        },
      })
      .eq("game_id", game.game_id)
      .then(() => { /* intentionally swallow — columns may not exist yet */ });

    const { error: deleteOldStatsError } = await supabaseAdmin
      .from("player_game_stats")
      .delete()
      .eq("game_id", game.game_id);

    if (deleteOldStatsError) {
      throw new Error(`Failed to clear existing player stats: ${deleteOldStatsError.message}`);
    }

    const { data: playersData, error: playersError } = await supabaseAdmin
      .from("players")
      .select("player_id, team_id, first_name, last_name, jersey_number");

    if (playersError) {
      throw new Error(`Failed to load players: ${playersError.message}`);
    }

    const existingPlayers = (playersData ?? []) as ExistingPlayer[];
    const playersByTeam = new Map<string, ExistingPlayer[]>();
    for (const p of existingPlayers) {
      const arr = playersByTeam.get(p.team_id) ?? [];
      arr.push(p);
      playersByTeam.set(p.team_id, arr);
    }

    const resolutionItems = Array.isArray(job.resolution_json)
      ? (job.resolution_json as ResolutionItem[])
      : [];
    const resolvedPlayerByKey = new Map<string, string>();
    for (const item of resolutionItems) {
      const key = resolutionKey(
        normalizeCode(item.team_code),
        toNumber(item.number),
        toStringOrNull(item.extracted_name)
      );
      if (item.resolved_player_id !== undefined && item.resolved_player_id !== null) {
        resolvedPlayerByKey.set(key, String(item.resolved_player_id));
      }
    }

    const players = Array.isArray(extraction.players) ? extraction.players : [];
    const playerStatRows = players
      .map((player) => {
      const teamCode = normalizeCode(player.team_code);
      const teamId = teamCode ? teamIdByCode.get(teamCode) ?? null : null;
      if (!teamId) {
        return null;
      }
      const playerNumber = toNumber(player.number);
      const playerName = toStringOrNull(player.name);
      const resolutionId = resolvedPlayerByKey.get(
        resolutionKey(teamCode, playerNumber, playerName)
      );
      const teamRoster = playersByTeam.get(teamId) ?? [];
      const playerId = findPlayerId(player, teamId, teamRoster, resolutionId ?? null);
      if (!playerId) {
        return null;
      }
      const stats = player.stats ?? {};

      const row: PlayerGameStatInsert = {
        game_id: game.game_id,
        source_job_id: job.id,
        player_id: playerId,
        team_id: teamId,
        is_starter: player.starter ?? false,
        is_captain: player.captain ?? false,
        dnp: player.dnp ?? false,
        minutes: toStringOrNull(stats.min),
        fg_made: toNumber(stats.fg_made),
        fg_att: toNumber(stats.fg_att),
        two_made: toNumber(stats.two_made),
        two_att: toNumber(stats.two_att),
        three_made: toNumber(stats.three_made),
        three_att: toNumber(stats.three_att),
        ft_made: toNumber(stats.ft_made),
        ft_att: toNumber(stats.ft_att),
        reb_off: toNumber(stats.reb_off),
        reb_def: toNumber(stats.reb_def),
        reb_tot: toNumber(stats.reb_tot),
        assists: toNumber(stats.assists),
        turnovers: toNumber(stats.turnovers),
        steals: toNumber(stats.steals),
        blocks: toNumber(stats.blocks),
        fouls_personal: toNumber(stats.fouls_personal),
        fouls_drawn: toNumber(stats.fouls_drawn),
        plus_minus: toNumber(stats.plus_minus),
        efficiency: toNumber(stats.efficiency),
        points: toNumber(stats.points),
      };
      return row;
      })
      .filter((row): row is PlayerGameStatInsert => row !== null);

    if (playerStatRows.length > 0) {
      const { error: playerStatsError } = await supabaseAdmin
        .from("player_game_stats")
        .insert(playerStatRows);

      if (playerStatsError) {
        // If extended columns don't exist yet (migration not run), fall back to core-only insert
        if (playerStatsError.message.includes("column") && playerStatsError.message.includes("schema cache")) {
          const coreRows = playerStatRows.map(({ game_id, player_id, team_id, points }) => ({
            game_id,
            player_id,
            team_id,
            points,
          }));
          const { error: fallbackError } = await supabaseAdmin
            .from("player_game_stats")
            .insert(coreRows);
          if (fallbackError) {
            throw new Error(`Failed to insert player_game_stats: ${fallbackError.message}`);
          }
        } else {
          throw new Error(`Failed to insert player_game_stats: ${playerStatsError.message}`);
        }
      }
    }

    const teamSummary = Array.isArray(extraction.team_summary) ? extraction.team_summary : [];
    const teamSummaryRows = teamSummary.map((summary) => {
      const teamCode = normalizeCode(summary.team_code);
      return {
        game_id: game.game_id,
        source_job_id: job.id,
        team_id: teamCode ? teamIdByCode.get(teamCode) ?? null : null,
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
      };
    });

    if (teamSummaryRows.length > 0) {
      const { error: teamSummaryError } = await supabaseAdmin
        .from("game_team_summary")
        .insert(teamSummaryRows);

      if (teamSummaryError) {
        // Keep commit compatible with existing schema where this table may not exist yet.
        if (!teamSummaryError.message.includes("Could not find the table")) {
          throw new Error(`Failed to insert game_team_summary: ${teamSummaryError.message}`);
        }
      }
    }

    const { error: jobUpdateError } = await supabaseAdmin
      .from("processing_jobs")
      .update({
        status: "committed",
        committed_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (jobUpdateError) {
      throw new Error(`Failed to update job to committed: ${jobUpdateError.message}`);
    }

    return { game_id: game.game_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown commit error";
    await setCommitError(jobId, message);
    throw error;
  }
}
