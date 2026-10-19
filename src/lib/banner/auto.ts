import { createClient } from "@supabase/supabase-js";
import { runAutoBanner, type AutoBannerDeps, type AutoBannerResult, type ExistingBanner, type GameForBanner } from "./auto-plan";
import { generateDraft } from "./service";

export type { AutoBannerResult } from "./auto-plan";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Reuses generateDraft (renderer, photo selection, storage, optimistic locking); nothing is published here.
const deps: AutoBannerDeps = {
  async loadGame(gameId) {
    const { data, error } = await db
      .from("games")
      .select("game_id, home_team_id, away_team_id, home_score, away_score")
      .eq("game_id", gameId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as GameForBanner | null) ?? null;
  },
  async teamsExist(ids) {
    const { data, error } = await db.from("teams").select("team_id").in("team_id", ids);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((t) => t.team_id)).size === new Set(ids).size;
  },
  async loadBanner(gameId) {
    const { data, error } = await db
      .from("homepage_banners")
      .select("banner_id, status, source_snapshot, photo_choice")
      .eq("game_id", gameId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as ExistingBanner | null) ?? null;
  },
  async generate(gameId, photo) {
    const result = await generateDraft(gameId, { photo });
    return result.ok ? { ok: true, banner_id: result.data.banner_id } : { ok: false, status: result.status, error: result.error };
  },
};

export function generateBannerForGame(gameId: string): Promise<AutoBannerResult> {
  return runAutoBanner(deps, gameId);
}

/** Runs generation for a committed job and records the outcome on it. Never throws, so it cannot undo a commit. */
export async function generateBannerAfterCommit(jobId: string, gameId: string): Promise<AutoBannerResult> {
  const result = await generateBannerForGame(gameId);
  if (result.status === "failed") console.error("[banner-auto] generation failed", { jobId, gameId, message: result.message });
  try {
    const { error } = await db.from("processing_jobs").update({ banner_result: result }).eq("id", jobId);
    if (error) console.error("[banner-auto] could not record result", { jobId, message: error.message });
  } catch (err) {
    console.error("[banner-auto] could not record result", { jobId, err });
  }
  return result;
}
