import { supabase } from "@/lib/supabase/client";

export const EXCLUDED_TEAM_NAMES = ["Veterans"] as const;

export type Season = {
  season: string;
  is_current: boolean;
};

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