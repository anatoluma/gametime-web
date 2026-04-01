const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringOrNull(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeCode(value) {
  const str = toStringOrNull(value);
  return str ? str.toUpperCase() : null;
}

function buildPlayedAt(date, time) {
  if (!date) {
    return null;
  }
  const iso = time ? `${date}T${time}:00` : `${date}T00:00:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function computeSeasonFromTipoff(tipoffIso, fallbackSeasonId) {
  if (tipoffIso) {
    const d = new Date(tipoffIso);
    if (!Number.isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const startYear = month >= 8 ? year : year - 1;
      return `${startYear}/${String(startYear + 1).slice(-2)}`;
    }
  }
  return fallbackSeasonId != null ? String(fallbackSeasonId) : null;
}

function generateGameId(tipoffIso, homeTeamId, awayTeamId) {
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

function getVenueFromHomeTeam(homeTeamId) {
  switch ((homeTeamId || "").toUpperCase()) {
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

function normalizeName(value) {
  if (!value) {
    return "";
  }
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\s'’-]+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function buildNameCandidates(player) {
  const first = normalizeName(player.first_name);
  const last = normalizeName(player.last_name);
  const full = normalizeName(`${player.first_name || ""}${player.last_name || ""}`);
  const initialLast = first.length > 0 ? `${first[0]}${last}` : "";
  return [full, `${first}${last}`, initialLast, last].filter((v, i, arr) => v && arr.indexOf(v) === i);
}

function findPlayerId(player, teamId, teamPlayers, resolvedPlayerId) {
  if (resolvedPlayerId && teamPlayers.some((p) => p.player_id === resolvedPlayerId)) {
    return resolvedPlayerId;
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
    const byName = teamPlayers.find((p) => buildNameCandidates(p).includes(extracted));
    if (byName) {
      return byName.player_id;
    }
  }
  return null;
}

async function main() {
  loadEnv();

  const jobId = process.argv[2];
  if (!jobId) {
    throw new Error("Usage: node scripts/ocr-preview.js <job_id>");
  }

  const jiti = require("jiti")(path.join(process.cwd(), "scripts", "ocr-preview-runner.js"));
  const { EXTRACTION_PROMPT } = jiti(path.join(process.cwd(), "src", "lib", "extraction-prompt.ts"));
  const { validateExtraction } = jiti(path.join(process.cwd(), "src", "lib", "validation.ts"));
  const { resolvePlayerNames } = jiti(path.join(process.cwd(), "src", "lib", "name-resolution.ts"));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: job, error: jobError } = await supabase
    .from("processing_jobs")
    .select("id, season_id, competition_id, raw_file_path")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    throw new Error(jobError?.message || `Job ${jobId} not found`);
  }

  await supabase
    .from("processing_jobs")
    .update({ status: "extracting", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  const bucket = process.env.BOX_SCORES_STORAGE_BUCKET || "uploads";
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(job.raw_file_path);

  if (downloadError || !fileBlob) {
    throw new Error(downloadError?.message || "Failed to download uploaded image");
  }

  const imageArrayBuffer = await fileBlob.arrayBuffer();
  const mediaType = job.raw_file_path.toLowerCase().endsWith(".png")
    ? "image/png"
    : job.raw_file_path.toLowerCase().endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: Buffer.from(imageArrayBuffer).toString("base64"),
              },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  });

  const anthropicBody = await anthropicResponse.json();
  if (!anthropicResponse.ok) {
    throw new Error(anthropicBody?.error?.message || "Claude request failed");
  }

  const outputText = anthropicBody?.content?.find((item) => item.type === "text")?.text;
  if (!outputText) {
    throw new Error("Claude returned no text output");
  }

  const extraction = JSON.parse(outputText);
  const validation = validateExtraction(extraction);

  await supabase
    .from("processing_jobs")
    .update({
      extraction_json: extraction,
      validation_json: validation,
      status: "validating",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  let resolution = [];
  let resolutionWarning = null;
  try {
    resolution = await resolvePlayerNames(jobId);
  } catch (error) {
    resolutionWarning = error instanceof Error ? error.message : String(error);
  }

  const { data: teamsData } = await supabase.from("teams").select("*");
  const { data: playersData } = await supabase
    .from("players")
    .select("player_id, team_id, first_name, last_name, jersey_number");

  const teamIdByCode = new Map();
  for (const team of teamsData || []) {
    const codes = [team.team_id, team.code, team.team_code, team.abbreviation, team.short_code]
      .map(normalizeCode)
      .filter(Boolean);
    for (const code of codes) {
      teamIdByCode.set(code, team.team_id);
    }
  }

  const playersByTeam = new Map();
  for (const player of playersData || []) {
    const arr = playersByTeam.get(player.team_id) || [];
    arr.push(player);
    playersByTeam.set(player.team_id, arr);
  }

  const resolutionMap = new Map(
    (resolution || []).map((item) => [
      `${normalizeCode(item.team_code) || ""}|${item.number ?? ""}|${(item.extracted_name || "").trim().toLowerCase()}`,
      item.resolved_player_id || null,
    ])
  );

  const homeTeamId = teamIdByCode.get(normalizeCode(extraction?.home_team?.code)) || null;
  const awayTeamId = teamIdByCode.get(normalizeCode(extraction?.away_team?.code)) || null;
  const playedAt = buildPlayedAt(toStringOrNull(extraction?.meta?.date), toStringOrNull(extraction?.meta?.start_time));
  const previewGameRow = homeTeamId && awayTeamId ? {
    game_id: generateGameId(playedAt, homeTeamId, awayTeamId),
    source_job_id: jobId,
    competition_id: job.competition_id,
    game_number: toNumber(extraction?.meta?.game_number),
    tipoff: playedAt,
    season: computeSeasonFromTipoff(playedAt, job.season_id),
    venue: getVenueFromHomeTeam(homeTeamId),
    duration_minutes: toNumber(extraction?.meta?.duration_minutes),
    crew_chief: toStringOrNull(extraction?.meta?.crew_chief),
    umpires: Array.isArray(extraction?.meta?.umpires) ? extraction.meta.umpires : [],
    score_intervals: {
      home: Array.isArray(extraction?.score_by_periods?.home?.intervals) ? extraction.score_by_periods.home.intervals : [],
      away: Array.isArray(extraction?.score_by_periods?.away?.intervals) ? extraction.score_by_periods.away.intervals : [],
    },
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    home_score: toNumber(extraction?.home_team?.score),
    away_score: toNumber(extraction?.away_team?.score),
  } : null;

  const previewPlayerRows = (Array.isArray(extraction?.players) ? extraction.players : [])
    .map((player) => {
      const teamCode = normalizeCode(player.team_code);
      const teamId = teamIdByCode.get(teamCode) || null;
      if (!teamId || !previewGameRow) {
        return null;
      }
      const key = `${teamCode || ""}|${toNumber(player.number) ?? ""}|${(toStringOrNull(player.name) || "").toLowerCase()}`;
      const resolvedId = resolutionMap.get(key) || null;
      const roster = playersByTeam.get(teamId) || [];
      const playerId = findPlayerId(player, teamId, roster, resolvedId);
      return {
        game_id: previewGameRow.game_id,
        source_job_id: jobId,
        player_id: playerId,
        team_id: teamId,
        extracted_name: player.name || null,
        number: toNumber(player.number),
        is_starter: player.starter ?? false,
        is_captain: player.captain ?? false,
        dnp: player.dnp ?? false,
        minutes: toStringOrNull(player?.stats?.min),
        fg_made: toNumber(player?.stats?.fg_made),
        fg_att: toNumber(player?.stats?.fg_att),
        two_made: toNumber(player?.stats?.two_made),
        two_att: toNumber(player?.stats?.two_att),
        three_made: toNumber(player?.stats?.three_made),
        three_att: toNumber(player?.stats?.three_att),
        ft_made: toNumber(player?.stats?.ft_made),
        ft_att: toNumber(player?.stats?.ft_att),
        reb_off: toNumber(player?.stats?.reb_off),
        reb_def: toNumber(player?.stats?.reb_def),
        reb_tot: toNumber(player?.stats?.reb_tot),
        assists: toNumber(player?.stats?.assists),
        turnovers: toNumber(player?.stats?.turnovers),
        steals: toNumber(player?.stats?.steals),
        blocks: toNumber(player?.stats?.blocks),
        fouls_personal: toNumber(player?.stats?.fouls_personal),
        fouls_drawn: toNumber(player?.stats?.fouls_drawn),
        plus_minus: toNumber(player?.stats?.plus_minus),
        efficiency: toNumber(player?.stats?.efficiency),
        points: toNumber(player?.stats?.points),
      };
    })
    .filter(Boolean);

  const previewTeamSummaryRows = (Array.isArray(extraction?.team_summary) ? extraction.team_summary : [])
    .map((summary) => ({
      game_id: previewGameRow?.game_id || null,
      source_job_id: jobId,
      team_id: teamIdByCode.get(normalizeCode(summary.team_code)) || null,
      ...summary,
    }));

  const failedChecks = validation.filter((check) => !check.passed);

  console.log(JSON.stringify({
    job_id: jobId,
    extracted_meta: extraction.meta,
    home_team: extraction.home_team,
    away_team: extraction.away_team,
    players_count: Array.isArray(extraction.players) ? extraction.players.length : 0,
    sample_players: (Array.isArray(extraction.players) ? extraction.players : []).slice(0, 6),
    validation_summary: {
      total_checks: validation.length,
      failed_checks: failedChecks,
    },
    resolution_warning: resolutionWarning,
    resolution_sample: (resolution || []).slice(0, 8),
    preview_game_row: previewGameRow,
    preview_player_rows_sample: previewPlayerRows.slice(0, 8),
    preview_team_summary_rows: previewTeamSummaryRows,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});