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
  const { home_score: home, away_score: away } = game;
  // Missing or non-numeric scores never produce a winner.
  if (typeof home !== "number" || typeof away !== "number" || !Number.isFinite(home) || !Number.isFinite(away)) {
    return "draw";
  }
  if (home === away) return "draw";
  return home > away ? "home" : "away";
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

/** team_id is Team 1 (the visual focus); second_team_id is the optional Team 2. */
export type PhotoCandidate = { team_id: string; second_team_id: string | null; is_neutral: boolean };

/**
 * a = both teams, winner is Team 1, not neutral   b = winner only
 * c = both teams, neutral or loser is Team 1      d = loser only
 * (no qualifying photo = priority e, the branded fallback)
 */
export type PhotoTier = "a" | "b" | "c" | "d";

const TIER_ORDER: PhotoTier[] = ["a", "b", "c", "d"];

/** Null when the photo shows a team outside this matchup. Two-team matching ignores team order. */
export function classifyPhoto(
  game: Pick<BannerGameInput, "home_team_id" | "away_team_id" | "home_score" | "away_score">,
  photo: PhotoCandidate
): PhotoTier | null {
  const matchup = [game.home_team_id, game.away_team_id];
  const winnerSide = getWinner(game);
  const winnerId = winnerSide === "draw" ? null : winnerSide === "home" ? game.home_team_id : game.away_team_id;

  if (photo.second_team_id) {
    const both =
      photo.team_id !== photo.second_team_id &&
      matchup.includes(photo.team_id) &&
      matchup.includes(photo.second_team_id);
    if (!both) return null;
    return winnerId !== null && photo.team_id === winnerId && !photo.is_neutral ? "a" : "c";
  }

  if (!matchup.includes(photo.team_id)) return null;
  return winnerId !== null && photo.team_id === winnerId ? "b" : "d";
}

/**
 * Highest-priority tier wins; within a tier the pick is seeded by game_id so regenerating
 * the same game keeps the same photo. Tiers a/b use the winner narrative, the rest the neutral one.
 */
export function selectBannerPhoto<T extends PhotoCandidate>(
  game: BannerGameInput,
  photos: T[]
): { photo: T | null; narrative: BannerContent["narrative"] } {
  const tiers = new Map<PhotoTier, T[]>();
  for (const photo of photos) {
    const tier = classifyPhoto(game, photo);
    if (tier) tiers.set(tier, [...(tiers.get(tier) ?? []), photo]);
  }

  for (const tier of TIER_ORDER) {
    const pool = tiers.get(tier);
    if (pool?.length) {
      return {
        photo: pool[stableIndex(game.game_id, pool.length)],
        narrative: tier === "a" || tier === "b" ? "winner" : "matchup",
      };
    }
  }
  return { photo: null, narrative: "matchup" };
}

export type BannerTeamRow = { team_id: string; team_name: string | null; logo_url: string | null };

/**
 * Assembles template input from structured data. Image sourcing is injected so the same
 * code can read local files (preview CLI) or Supabase Storage (later phases).
 */
export async function buildBannerContent<P extends PhotoCandidate>(
  game: BannerGameInput,
  options: {
    home: BannerTeamRow;
    away: BannerTeamRow;
    photos: P[];
    headline?: string | null;
    loadLogo: (team: BannerTeamRow) => Promise<string | null>;
    loadPhoto: (source: P) => Promise<string>;
  }
): Promise<BannerContent> {
  const { home, away } = options;
  const { photo: source, narrative } = selectBannerPhoto(game, options.photos);
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
    narrative,
    photo,
  };
}
