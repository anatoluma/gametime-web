export type BannerTeam = {
  code: string;
  name: string;
  /** PNG/JPEG data URI (Satori cannot decode WebP), or null to fall back to the team code. */
  logo: string | null;
};

export type BannerContent = {
  home: BannerTeam;
  away: BannerTeam;
  homeScore: number;
  awayScore: number;
  winner: "home" | "away" | "draw";
  /** Pre-formatted, e.g. "20 SEP 2026". */
  dateLabel: string;
  season: string | null;
  headline: string | null;
  /** "winner" highlights the winning score; "matchup" presents both sides evenly. */
  narrative: "winner" | "matchup";
  /** JPEG/PNG data URI sized for 1600x600; null renders the branded gradient. */
  photo: string | null;
};
