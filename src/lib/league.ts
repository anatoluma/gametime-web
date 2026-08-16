import { supabase } from "@/lib/supabase/client";

export const EXCLUDED_TEAM_NAMES = ["Veterans"] as const;

export type Season = {
  season: string;
  is_current: boolean;
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
  const visibleTeams = teams.filter((team) => !isExcludedTeamName(team.team_name));
  const visibleTeamIds = new Set(visibleTeams.map((team) => team.team_id));

  return { visibleTeams, visibleTeamIds };
}

export function isVisibleGame<T extends GameIdentity>(game: T, visibleTeamIds: Set<string>) {
  return visibleTeamIds.has(game.home_team_id) && visibleTeamIds.has(game.away_team_id);
}