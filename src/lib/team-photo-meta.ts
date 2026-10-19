export type PhotoTeams = {
  team_id: string;
  second_team_id: string | null;
  is_neutral: boolean;
};

/** Mirrors the team_photos CHECK constraints; returns an error message or null. */
export function validatePhotoTeams(p: PhotoTeams): string | null {
  if (!p.team_id) return "Team 1 is required";
  if (p.second_team_id !== null && p.second_team_id === p.team_id) return "Team 1 and Team 2 must differ";
  if (p.is_neutral && p.second_team_id === null) return "A neutral photo needs a Team 2";
  return null;
}
