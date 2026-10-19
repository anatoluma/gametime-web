import type { BannerContent } from "./types";

export type BannerGameInput = {
  game_id: string;
  tipoff: string;
  season: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
};

export function getWinner(game: Pick<BannerGameInput, "home_score" | "away_score">): BannerContent["winner"] {
  if (game.home_score === game.away_score) return "draw";
  return game.home_score > game.away_score ? "home" : "away";
}

/** Local calendar date in Moldova, e.g. "20 SEP 2026". */
export function formatBannerDate(tipoff: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Chisinau",
  }).formatToParts(new Date(tipoff));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}`.toUpperCase();
}

function stableIndex(seed: string, length: number): number {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % length;
}

/**
 * Winner's photos first, then the other team's; null when neither has any.
 * Seeded by game_id so regenerating the same game picks the same photo.
 */
export function pickPhotoSource<T>(game: BannerGameInput, photosByTeam: Record<string, T[]>): T | null {
  const winner = getWinner(game);
  const order =
    winner === "away"
      ? [game.away_team_id, game.home_team_id]
      : [game.home_team_id, game.away_team_id];

  for (const teamId of order) {
    const photos = photosByTeam[teamId] ?? [];
    if (photos.length) return photos[stableIndex(game.game_id, photos.length)];
  }
  return null;
}

export type BannerTeamRow = { team_id: string; team_name: string | null; logo_url: string | null };

/**
 * Assembles template input from structured data. Image sourcing is injected so the same
 * code can read local files (preview CLI) or Supabase Storage (later phases).
 */
export async function buildBannerContent<P>(
  game: BannerGameInput,
  options: {
    home: BannerTeamRow;
    away: BannerTeamRow;
    photosByTeam: Record<string, P[]>;
    headline?: string | null;
    loadLogo: (team: BannerTeamRow) => Promise<string | null>;
    loadPhoto: (source: P) => Promise<string>;
  }
): Promise<BannerContent> {
  const { home, away } = options;
  const source = pickPhotoSource(game, options.photosByTeam);
  const [homeLogo, awayLogo, photo] = await Promise.all([
    options.loadLogo(home),
    options.loadLogo(away),
    source === null ? Promise.resolve(null) : options.loadPhoto(source),
  ]);

  return {
    home: { code: home.team_id, name: home.team_name ?? home.team_id, logo: homeLogo },
    away: { code: away.team_id, name: away.team_name ?? away.team_id, logo: awayLogo },
    homeScore: game.home_score,
    awayScore: game.away_score,
    winner: getWinner(game),
    dateLabel: formatBannerDate(game.tipoff),
    season: game.season,
    headline: options.headline?.trim() || null,
    photo,
  };
}
