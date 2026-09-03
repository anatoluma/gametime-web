import { supabase } from "@/lib/supabase/client";

export const EXCLUDED_TEAM_NAMES = ["Veterans"] as const;

/** Retired entities that are kept for historical stats but never listed as competitors. */
export const EXCLUDED_TEAM_IDS = ["VET", "ALU"] as const;

export type Season = {
  season: string;
  is_current: boolean;
};

export type SeasonTeam = {
  team_id: string;
  team_name: string | null;
  city: string | null;
  coach: string | null;
  logo_url: string | null;
};

/** Normalizes free-typed season labels (e.g. "2025-2026", " 2025-2026 ") to the canonical "YYYY/YY" form used everywhere else. */
export function normalizeSeasonLabel(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{4})\s*[/-]\s*(\d{2,4})$/);
  if (!match) return trimmed;

  const startYear = match[1];
  const endPart = match[2];
  const endYearShort = endPart.length === 4 ? endPart.slice(-2) : endPart.padStart(2, "0");
  return `${startYear}/${endYearShort}`;
}

/** Returns all seasons ordered newest-first. */
export async function getAvailableSeasons(): Promise<Season[]> {
  const { data } = await supabase
    .from("seasons")
    .select("season, is_current")
    .order("season", { ascending: false });
  return (data ?? []) as Season[];
}

/** Returns the season currently flagged is_current, or the newest season as fallback. */
export async function getCurrentSeason(): Promise<string> {
  const seasons = await getAvailableSeasons();
  return seasons.find((s) => s.is_current)?.season ?? seasons[0]?.season ?? "2025/26";
}

/**
 * The season the public site should show: the newest one that actually has
 * games. Deliberately not `is_current` — a season is flagged current while it
 * is still being set up, so `is_current` would point the public site at an
 * empty schedule. This auto-advances the moment the new season's first game is
 * entered.
 */
export async function getPublicSeason(): Promise<string> {
  const [seasons, newest] = await Promise.all([
    getAvailableSeasons(),
    supabase
      .from("games")
      .select("season")
      .not("season", "is", null)
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .order("season", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Cross-check against `seasons` so a typo'd label in `games` can't hijack the site.
  const candidate = newest.data?.season?.trim();
  if (candidate && seasons.some((s) => s.season === candidate)) return candidate;

  return seasons.find((s) => s.is_current)?.season ?? seasons[0]?.season ?? "2025/26";
}

/**
 * Teams enrolled in `season` (from `team_seasons`), joined to their canonical
 * details. Throws on a query error rather than returning an empty list — an
 * empty season and a broken query must not look the same.
 */
export async function getSeasonTeams(
  season: string,
  opts?: { includeInactive?: boolean }
): Promise<SeasonTeam[]> {
  let query = supabase
    .from("team_seasons")
    .select("team_id, is_active, teams!inner(team_name, city, coach, logo_url)")
    .eq("season", season);

  if (!opts?.includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;

  type Row = {
    team_id: string;
    teams: { team_name: string | null; city: string | null; coach: string | null; logo_url: string | null };
  };

  return ((data ?? []) as unknown as Row[])
    .map((row) => ({
      team_id: row.team_id,
      team_name: row.teams.team_name,
      city: row.teams.city,
      coach: row.teams.coach,
      logo_url: row.teams.logo_url,
    }))
    .sort((a, b) => (a.team_name ?? a.team_id).localeCompare(b.team_name ?? b.team_id));
}

/** getSeasonTeams minus the retired entities. What public pages should call. */
export async function getVisibleSeasonTeams(season: string): Promise<SeasonTeam[]> {
  return getVisibleTeams(await getSeasonTeams(season)).visibleTeams;
}

export function isExcludedTeamName(teamName?: string | null) {
  if (!teamName) return false;

  const normalizedName = teamName.trim().toLowerCase();
  return EXCLUDED_TEAM_NAMES.some((name) => name.toLowerCase() === normalizedName);
}

type TeamIdentity = {
  team_id: string;
  team_name: string | null;
};

type GameIdentity = {
  home_team_id: string;
  away_team_id: string;
};

export function getVisibleTeams<T extends TeamIdentity>(teams: T[]) {
  const excludedIds: readonly string[] = EXCLUDED_TEAM_IDS;
  const visibleTeams = teams.filter(
    (team) => !isExcludedTeamName(team.team_name) && !excludedIds.includes(team.team_id)
  );
  const visibleTeamIds = new Set(visibleTeams.map((team) => team.team_id));

  return { visibleTeams, visibleTeamIds };
}

export function isVisibleGame<T extends GameIdentity>(game: T, visibleTeamIds: Set<string>) {
  return visibleTeamIds.has(game.home_team_id) && visibleTeamIds.has(game.away_team_id);
}