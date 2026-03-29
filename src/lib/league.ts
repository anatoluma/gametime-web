export const EXCLUDED_TEAM_NAMES = ["Veterans"] as const;

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