// Pure orchestration for automatic banner drafts. No runtime imports so node:test can load it directly.

export type GameForBanner = {
  game_id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

/** Fingerprint of the game data a banner was rendered from; a change means the banner may be outdated. */
export function gameSnapshot(game: Pick<GameForBanner, "home_team_id" | "away_team_id" | "home_score" | "away_score">): string {
  return `${game.home_team_id}|${game.away_team_id}|${game.home_score}|${game.away_score}`;
}

/** Null when the game can be bannered; otherwise the reason it cannot. Basketball has no ties, so a tie is treated as bad data. */
export function validateGameForBanner(game: GameForBanner | null): string | null {
  if (!game) return "Game not found";
  if (!game.home_team_id || !game.away_team_id) return "Both teams must be identified";
  if (game.home_team_id === game.away_team_id) return "Home and away team are the same";
  const { home_score: home, away_score: away } = game;
  if (!Number.isInteger(home) || !Number.isInteger(away) || (home as number) < 0 || (away as number) < 0) {
    return "Game has no valid final score";
  }
  if (home === away) return "Final score is tied; check the box score";
  return null;
}

export type AutoBannerStatus =
  | "created"
  | "regenerated"
  | "already_exists"
  | "approved_exists"
  | "skipped"
  | "failed";

export type AutoBannerResult = {
  status: AutoBannerStatus;
  message: string;
  game_id: string | null;
  banner_id?: string;
  /** Only for approved_exists: the published banner no longer matches the game's teams/scores. */
  outdated?: boolean;
  at: string;
};

export type ExistingBanner = {
  banner_id: string;
  status: "draft" | "approved" | "rejected";
  source_snapshot: string | null;
  photo_choice: string | null;
};

export type GenerateOutcome = { ok: true; banner_id: string } | { ok: false; status: number; error: string };

export type AutoBannerDeps = {
  loadGame(gameId: string): Promise<GameForBanner | null>;
  teamsExist(ids: string[]): Promise<boolean>;
  loadBanner(gameId: string): Promise<ExistingBanner | null>;
  /** `photo` is "auto", "none" or a photo id. The headline is never passed, so the stored one is kept. */
  generate(gameId: string, photo: string): Promise<GenerateOutcome>;
};

export async function runAutoBanner(deps: AutoBannerDeps, gameId: string): Promise<AutoBannerResult> {
  const done = (status: AutoBannerStatus, message: string, extra: Partial<AutoBannerResult> = {}): AutoBannerResult => ({
    status,
    message,
    game_id: gameId,
    at: new Date().toISOString(),
    ...extra,
  });

  try {
    const game = await deps.loadGame(gameId);
    const invalid = validateGameForBanner(game);
    if (invalid || !game) return done("skipped", invalid ?? "Game not found");
    if (!(await deps.teamsExist([game.home_team_id as string, game.away_team_id as string]))) {
      return done("skipped", "One or both teams do not exist");
    }

    const snapshot = gameSnapshot(game);
    const existing = await deps.loadBanner(gameId);

    if (existing?.status === "approved") {
      const outdated = existing.source_snapshot !== null && existing.source_snapshot !== snapshot;
      return done(
        "approved_exists",
        outdated
          ? "A published banner exists and was left unchanged, but the game's teams or score changed after it was generated. Review it in /admin/banners."
          : "A published banner already exists and was left unchanged.",
        { banner_id: existing.banner_id, outdated }
      );
    }

    // Unknown snapshot (banner predates tracking) is treated as current so nothing is overwritten.
    if (existing && (existing.source_snapshot === null || existing.source_snapshot === snapshot)) {
      return done("already_exists", "A banner draft already exists for this game.", { banner_id: existing.banner_id });
    }

    const choice = existing?.photo_choice ?? "auto";
    let outcome = await deps.generate(gameId, choice);
    // A manually chosen photo that no longer qualifies falls back to automatic selection.
    if (!outcome.ok && outcome.status === 400 && choice !== "auto" && choice !== "none") {
      outcome = await deps.generate(gameId, "auto");
    }

    if (!outcome.ok) {
      if (outcome.status === 409) {
        return done("already_exists", "A banner for this game was created or changed concurrently.");
      }
      return done("failed", outcome.error);
    }
    return existing
      ? done("regenerated", "Banner draft regenerated because the game's teams or score changed.", { banner_id: outcome.banner_id })
      : done("created", "Banner draft created. Review and approve it in /admin/banners.", { banner_id: outcome.banner_id });
  } catch (err) {
    return done("failed", err instanceof Error ? err.message : "Banner generation failed");
  }
}
