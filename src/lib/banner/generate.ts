import { ImageResponse } from "next/og";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBannerContent, type BannerGameInput } from "./content";
import { loadBannerFonts } from "./fonts";
import { loadTeamLogo, preparePhoto } from "./images";
import { renderBannerPng } from "./render";

export const TEAM_PHOTOS_BUCKET = "team-photos";

/** "auto" = winner's photo then opponent's, "none" = gradient only, otherwise a team_photos.photo_id. */
export type PhotoChoice = "auto" | "none" | string;

export class BannerRenderError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

type PhotoRow = { photo_id: string; team_id: string; storage_path: string };

export async function renderGameBanner(
  db: SupabaseClient,
  gameId: string,
  options: { headline: string | null; photo: PhotoChoice }
): Promise<{ png: Buffer; photoId: string | null }> {
  const { data: game, error: gameError } = await db
    .from("games")
    .select("game_id, tipoff, season, home_team_id, away_team_id, home_score, away_score")
    .eq("game_id", gameId)
    .maybeSingle();

  if (gameError) throw new BannerRenderError(500, gameError.message);
  if (!game) throw new BannerRenderError(404, "Game not found");
  if (game.home_score == null || game.away_score == null) {
    throw new BannerRenderError(400, "Game has no final score yet");
  }

  const teamIds = [game.home_team_id, game.away_team_id];
  const [{ data: teams, error: teamsError }, { data: photos, error: photosError }] = await Promise.all([
    db.from("teams").select("team_id, team_name, logo_url").in("team_id", teamIds),
    db
      .from("team_photos")
      .select("photo_id, team_id, storage_path")
      .in("team_id", teamIds)
      .eq("is_active", true),
  ]);
  if (teamsError) throw new BannerRenderError(500, teamsError.message);
  if (photosError) throw new BannerRenderError(500, photosError.message);

  const teamRow = (id: string) =>
    teams?.find((t) => t.team_id === id) ?? { team_id: id, team_name: id, logo_url: null };

  let candidates = (photos ?? []) as PhotoRow[];
  if (options.photo === "none") {
    candidates = [];
  } else if (options.photo !== "auto") {
    candidates = candidates.filter((p) => p.photo_id === options.photo);
    if (!candidates.length) {
      throw new BannerRenderError(400, "Selected photo is not an active photo of either team");
    }
  }

  const photosByTeam: Record<string, PhotoRow[]> = { [teamIds[0]]: [], [teamIds[1]]: [] };
  for (const photo of candidates) photosByTeam[photo.team_id].push(photo);

  let photoId: string | null = null;
  const content = await buildBannerContent<PhotoRow>(game as BannerGameInput, {
    home: teamRow(game.home_team_id),
    away: teamRow(game.away_team_id),
    photosByTeam,
    headline: options.headline,
    loadLogo: loadTeamLogo,
    loadPhoto: async (photo) => {
      const { data, error } = await db.storage.from(TEAM_PHOTOS_BUCKET).download(photo.storage_path);
      if (error || !data) throw new BannerRenderError(500, `Could not read photo: ${error?.message ?? "empty"}`);
      photoId = photo.photo_id;
      return preparePhoto(Buffer.from(await data.arrayBuffer()));
    },
  });

  const png = await renderBannerPng(content, await loadBannerFonts(), ImageResponse);
  return { png, photoId };
}
