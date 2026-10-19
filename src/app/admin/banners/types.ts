export type Game = {
  game_id: string;
  tipoff: string | null;
  season: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

export type AdminBanner = {
  banner_id: string;
  game_id: string;
  status: "draft" | "approved" | "rejected";
  photo_id: string | null;
  headline: string | null;
  sort_order: number;
  image_version: number;
  generated_at: string | null;
  reviewed_by: string | null;
  published_path: string | null;
  game: Game | null;
  /** The game's teams or score changed after this banner was rendered. */
  outdated?: boolean;
  /** Short-lived signed URL of the private draft image. */
  preview_url: string | null;
  published_url: string | null;
};

export type Team = { team_id: string; team_name: string | null };

export type PhotoChoice = "auto" | "none" | string;

export function gameLabel(game: Game | null, teams: Map<string, string>, fallback: string) {
  if (!game) return fallback;
  const name = (id: string) => teams.get(id) ?? id;
  const date = game.tipoff
    ? new Date(game.tipoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";
  return `${name(game.home_team_id)} ${game.home_score}–${game.away_score} ${name(game.away_team_id)}${date ? ` · ${date}` : ""}`;
}
