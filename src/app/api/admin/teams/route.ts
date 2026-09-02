import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Season team management.
 *
 * `teams` is the canonical franchise list: a row means the team exists in the
 * league at all (`teams.is_active`). `team_seasons` records participation: a
 * row means the team is enrolled in that season, and `team_seasons.is_active`
 * means it is eligible to play it. The two are kept strictly separate here —
 * season-scoped changes must never mutate the canonical row, because the
 * public site reads it.
 */

const TEAM_ID_RE = /^[A-Z0-9]{2,4}$/;

const SEASON_TEAM_SELECT = "team_id, is_active, teams!inner(team_id, team_name, city, coach, logo_url, is_active)";

type SeasonTeamJoin = {
  team_id: string;
  is_active: boolean | null;
  teams: {
    team_id: string;
    team_name: string | null;
    city: string | null;
    coach: string | null;
    logo_url: string | null;
    is_active: boolean | null;
  };
};

type SeasonTeamRow = {
  team_id: string;
  team_name: string | null;
  city: string | null;
  coach: string | null;
  logo_url: string | null;
  /** Season-scoped: does this team play the selected season. */
  is_active: boolean;
  /** Global: does the franchise exist in the league. */
  league_active: boolean;
};

function toSeasonTeamRow(row: SeasonTeamJoin): SeasonTeamRow {
  return {
    team_id: row.team_id,
    team_name: row.teams?.team_name ?? null,
    city: row.teams?.city ?? null,
    coach: row.teams?.coach ?? null,
    logo_url: row.teams?.logo_url ?? null,
    is_active: row.is_active ?? true,
    league_active: row.teams?.is_active ?? true,
  };
}

/** Re-reads the joined row so every mutation response carries a populated team_name. */
async function readSeasonTeam(team_id: string, season: string) {
  const { data, error } = await supabaseAdmin
    .from("team_seasons")
    .select(SEASON_TEAM_SELECT)
    .eq("team_id", team_id)
    .eq("season", season)
    .maybeSingle();

  if (error) return { row: null, error };
  return { row: data ? toSeasonTeamRow(data as unknown as SeasonTeamJoin) : null, error: null };
}

function badRequest(error: string, code?: string) {
  return NextResponse.json(code ? { error, code } : { error }, { status: 400 });
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season");

  if (season) {
    const { data, error } = await supabaseAdmin
      .from("team_seasons")
      .select(SEASON_TEAM_SELECT)
      .eq("season", season)
      .order("team_id");

    // Deliberately not swallowing "does not exist" here — a missing table or
    // column must surface as a 500, not masquerade as an empty season.
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const teams = ((data ?? []) as unknown as SeasonTeamJoin[]).map(toSeasonTeamRow);
    return NextResponse.json({ teams });
  }

  // No season: the canonical franchise list.
  const { data, error } = await supabaseAdmin
    .from("teams")
    .select("team_id, team_name, city, coach, logo_url, is_active")
    .order("team_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ teams: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const action = String(body?.action ?? "");

  switch (action) {
    case "create_team":
      return createTeam(body);
    case "enroll_team":
      return enrollTeam(body);
    case "import_all_league_teams":
      return importAllLeagueTeams(body);
    case "copy_from_season":
    // Legacy alias kept so any older client keeps working.
    case "migrate_from_previous_season":
      return copyFromSeason(body);
    case "derive_from_games":
      return deriveFromGames(body);
    default:
      return badRequest(
        "Unknown action. Expected one of: create_team, enroll_team, import_all_league_teams, copy_from_season, derive_from_games.",
        "UNKNOWN_ACTION"
      );
  }
}

/** Creates a brand-new franchise and enrolls it in the season. */
async function createTeam(body: Record<string, unknown>) {
  const season = String(body?.season ?? "").trim();
  const team_id = String(body?.team_id ?? "").trim().toUpperCase();
  const team_name = String(body?.team_name ?? "").trim();
  const city = String(body?.city ?? "").trim() || null;
  const coach = String(body?.coach ?? "").trim() || null;

  if (!season) return badRequest("season is required");
  if (!TEAM_ID_RE.test(team_id)) {
    return badRequest("Team code must be 2-4 letters or digits, e.g. EDI or CN2", "INVALID_TEAM_ID");
  }
  if (!team_name) return badRequest("team_name is required");

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("teams")
    .select("team_id, team_name")
    .eq("team_id", team_id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json(
      {
        error: `Team code ${team_id} is already taken by "${existing.team_name ?? team_id}". Use "Add existing team" instead.`,
        code: "TEAM_ID_TAKEN",
        existing,
      },
      { status: 409 }
    );
  }

  // insert, not upsert — an upsert here would silently overwrite a franchise.
  const { error: insertError } = await supabaseAdmin
    .from("teams")
    .insert({ team_id, team_name, city, coach, is_active: true });

  if (insertError) {
    // Lost a race against a concurrent create.
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: `Team code ${team_id} is already taken.`, code: "TEAM_ID_TAKEN" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: enrollError } = await supabaseAdmin
    .from("team_seasons")
    .upsert({ team_id, season, is_active: true }, { onConflict: "team_id,season" });

  if (enrollError) {
    return NextResponse.json({ error: enrollError.message }, { status: 500 });
  }

  const { row, error } = await readSeasonTeam(team_id, season);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ team: row });
}

/** Enrolls an existing franchise in a season. Never writes `teams`. */
async function enrollTeam(body: Record<string, unknown>) {
  const season = String(body?.season ?? "").trim();
  const team_id = String(body?.team_id ?? "").trim().toUpperCase();

  if (!season) return badRequest("season is required");
  if (!TEAM_ID_RE.test(team_id)) {
    return badRequest("Team code must be 2-4 letters or digits", "INVALID_TEAM_ID");
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("teams")
    .select("team_id")
    .eq("team_id", team_id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json(
      { error: `Unknown team code ${team_id}`, code: "TEAM_NOT_FOUND" },
      { status: 404 }
    );
  }

  const { error: enrollError } = await supabaseAdmin
    .from("team_seasons")
    .upsert({ team_id, season, is_active: true }, { onConflict: "team_id,season" });

  if (enrollError) {
    return NextResponse.json({ error: enrollError.message }, { status: 500 });
  }

  const { row, error } = await readSeasonTeam(team_id, season);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ team: row });
}

/**
 * Seeds a season from the canonical roster. Active franchises only by default:
 * the inactive ones are retired entities (ALU "ADMIRALS ALUMNI",
 * VET "VETERANS") that shouldn't be enrolled as competitors.
 */
async function importAllLeagueTeams(body: Record<string, unknown>) {
  const season = String(body?.season ?? "").trim();
  if (!season) return badRequest("season is required");

  let query = supabaseAdmin.from("teams").select("team_id");
  if (body?.include_inactive !== true) {
    query = query.eq("is_active", true);
  }

  const { data: teams, error: fetchError } = await query;
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const team_ids = (teams ?? []).map((team) => team.team_id);
  if (team_ids.length === 0) {
    return NextResponse.json({ error: "No league teams to import", code: "NOTHING_TO_IMPORT" }, { status: 404 });
  }

  const inserted = await upsertEnrollments(team_ids, season);
  if ("error" in inserted) return inserted.error;

  return NextResponse.json({ imported: inserted.count, season, team_ids: inserted.team_ids });
}

/** Year-over-year rollover: copies the previous season's active enrollments. */
async function copyFromSeason(body: Record<string, unknown>) {
  const source_season = String(body?.source_season ?? "").trim();
  const target_season = String(body?.target_season ?? "").trim();

  if (!source_season || !target_season) {
    return badRequest("source_season and target_season are required");
  }
  if (source_season === target_season) {
    return badRequest("source_season and target_season must differ");
  }

  const { data: priorTeams, error: fetchError } = await supabaseAdmin
    .from("team_seasons")
    .select("team_id")
    .eq("season", source_season)
    .eq("is_active", true);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const team_ids = (priorTeams ?? []).map((team) => team.team_id);
  if (team_ids.length === 0) {
    return NextResponse.json(
      { error: `No teams enrolled in ${source_season} to copy from`, code: "EMPTY_SOURCE_SEASON" },
      { status: 404 }
    );
  }

  const inserted = await upsertEnrollments(team_ids, target_season);
  if ("error" in inserted) return inserted.error;

  return NextResponse.json({ copied: inserted.count, source_season, target_season, team_ids: inserted.team_ids });
}

/**
 * Historical backfill: enrolls exactly the teams that appear in the season's
 * games. Set include_roster_teams to also pick up teams that only ever had a
 * roster entry.
 */
async function deriveFromGames(body: Record<string, unknown>) {
  const season = String(body?.season ?? "").trim();
  if (!season) return badRequest("season is required");

  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("home_team_id, away_team_id")
    .eq("season", season);

  if (gamesError) {
    return NextResponse.json({ error: gamesError.message }, { status: 500 });
  }

  const ids = new Set<string>();
  for (const game of games ?? []) {
    if (game.home_team_id) ids.add(game.home_team_id);
    if (game.away_team_id) ids.add(game.away_team_id);
  }

  if (body?.include_roster_teams === true) {
    const { data: roster, error: rosterError } = await supabaseAdmin
      .from("player_seasons")
      .select("team_id")
      .eq("season", season);

    if (rosterError) {
      return NextResponse.json({ error: rosterError.message }, { status: 500 });
    }

    for (const entry of roster ?? []) {
      if (entry.team_id) ids.add(entry.team_id);
    }
  }

  if (ids.size === 0) {
    return NextResponse.json(
      { error: `No games found in ${season}`, code: "NO_SEASON_GAMES" },
      { status: 404 }
    );
  }

  const inserted = await upsertEnrollments([...ids], season);
  if ("error" in inserted) return inserted.error;

  return NextResponse.json({ derived: inserted.count, season, team_ids: inserted.team_ids });
}

/**
 * Idempotent enrollment. Only genuinely new rows are written, so re-running a
 * seeding action never resurrects a team an admin deactivated for that season,
 * and the reported count reflects what actually changed.
 */
async function upsertEnrollments(team_ids: string[], season: string) {
  const { data: alreadyEnrolled, error: existingError } = await supabaseAdmin
    .from("team_seasons")
    .select("team_id")
    .eq("season", season)
    .in("team_id", team_ids);

  if (existingError) {
    return { error: NextResponse.json({ error: existingError.message }, { status: 500 }) };
  }

  const existing = new Set((alreadyEnrolled ?? []).map((row) => row.team_id));
  const toAdd = team_ids.filter((team_id) => !existing.has(team_id)).sort();

  if (toAdd.length === 0) {
    return { count: 0, team_ids: [] as string[] };
  }

  const { error: upsertError } = await supabaseAdmin
    .from("team_seasons")
    .upsert(
      toAdd.map((team_id) => ({ team_id, season, is_active: true })),
      { onConflict: "team_id,season", ignoreDuplicates: true }
    );

  if (upsertError) {
    return { error: NextResponse.json({ error: upsertError.message }, { status: 500 }) };
  }

  return { count: toAdd.length, team_ids: toAdd };
}

/**
 * Two mutually exclusive modes:
 *  - details ({team_id, team_name?, city?, coach?}) writes only `teams`
 *  - season  ({team_id, season, is_active})        writes only `team_seasons`
 *
 * Keeping them apart is what stops a per-season deactivation from hiding a
 * team across the whole public site.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const team_id = String(body?.team_id ?? "").trim().toUpperCase();
  const season = String(body?.season ?? "").trim();

  if (!team_id) return badRequest("team_id is required");

  if ("new_team_id" in body) {
    return badRequest(
      "team_id is immutable; it is referenced by games, players and player_seasons.",
      "TEAM_ID_IMMUTABLE"
    );
  }

  if (season) {
    if (!("is_active" in body)) {
      return badRequest("is_active is required when updating season participation");
    }

    for (const field of ["team_name", "city", "coach"]) {
      if (field in body) {
        return badRequest(
          `${field} is a league-wide detail. Send it without "season".`,
          "DETAILS_ARE_NOT_SEASON_SCOPED"
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("team_seasons")
      .update({ is_active: Boolean(body.is_active) })
      .eq("team_id", team_id)
      .eq("season", season)
      .select("team_id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data) {
      return NextResponse.json(
        { error: `${team_id} is not enrolled in ${season}`, code: "NOT_ENROLLED" },
        { status: 404 }
      );
    }

    const { row, error: readError } = await readSeasonTeam(team_id, season);
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

    return NextResponse.json({ team: row });
  }

  if ("is_active" in body) {
    return badRequest(
      'is_active is season-scoped. Pass "season" to change season participation.',
      "IS_ACTIVE_NEEDS_SEASON"
    );
  }

  const updates: Record<string, unknown> = {};
  if ("team_name" in body) {
    const team_name = String(body.team_name ?? "").trim();
    if (!team_name) return badRequest("team_name cannot be empty");
    updates.team_name = team_name;
  }
  if ("city" in body) updates.city = String(body.city ?? "").trim() || null;
  if ("coach" in body) updates.coach = String(body.coach ?? "").trim() || null;

  if (Object.keys(updates).length === 0) {
    return badRequest("No valid team fields to update");
  }

  const { data, error } = await supabaseAdmin
    .from("teams")
    .update(updates)
    .eq("team_id", team_id)
    .select("team_id, team_name, city, coach, is_active")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) {
    return NextResponse.json({ error: `Unknown team ${team_id}`, code: "TEAM_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    team: {
      team_id: data.team_id,
      team_name: data.team_name,
      city: data.city,
      coach: data.coach,
      is_active: true,
      league_active: data.is_active ?? true,
    },
  });
}

/**
 * Un-enrolls a team from a season. Deletes only the `team_seasons` row — the
 * franchise stays in `teams`. Refused when the season already has games or
 * roster entries referencing the team, since those would be orphaned.
 */
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const team_id = (searchParams.get("team_id") ?? "").trim().toUpperCase();
  const season = (searchParams.get("season") ?? "").trim();

  if (!season) return badRequest("season is required");
  // Also what makes the .or() interpolation below safe.
  if (!TEAM_ID_RE.test(team_id)) {
    return badRequest("team_id must be 2-4 letters or digits", "INVALID_TEAM_ID");
  }

  const [gamesRes, rosterRes] = await Promise.all([
    supabaseAdmin
      .from("games")
      .select("game_id", { count: "exact", head: true })
      .eq("season", season)
      .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`),
    supabaseAdmin
      .from("player_seasons")
      .select("player_id", { count: "exact", head: true })
      .eq("season", season)
      .eq("team_id", team_id),
  ]);

  if (gamesRes.error) return NextResponse.json({ error: gamesRes.error.message }, { status: 500 });
  if (rosterRes.error) return NextResponse.json({ error: rosterRes.error.message }, { status: 500 });

  const games = gamesRes.count ?? 0;
  const roster = rosterRes.count ?? 0;

  if (games > 0 || roster > 0) {
    return NextResponse.json(
      {
        error: `Cannot remove ${team_id} from ${season} — ${games} game(s) and ${roster} roster entry(ies) reference it. Set it inactive for this season instead.`,
        code: "TEAM_HAS_SEASON_DATA",
        games,
        roster,
      },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin
    .from("team_seasons")
    .delete()
    .eq("team_id", team_id)
    .eq("season", season);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ removed: true, team_id, season });
}
