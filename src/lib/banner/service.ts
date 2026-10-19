import { createClient } from "@supabase/supabase-js";
import { BannerRenderError, renderGameBanner, type PhotoChoice } from "./generate";
import { gameSnapshot } from "./auto-plan";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const DRAFTS_BUCKET = "banner-drafts";
const PUBLIC_BUCKET = "banners";
const MAX_HEADLINE = 80;
const SIGNED_URL_TTL_SECONDS = 3600;
const MAX_PNG_BYTES = 5 * 1024 * 1024; // matches both buckets' file_size_limit

const ROW_COLUMNS =
  "banner_id, game_id, status, photo_id, headline, image_path, published_path, image_version, sort_order, generated_at, reviewed_by, reviewed_at, created_at, updated_at, source_snapshot, photo_choice";

export type BannerRow = {
  banner_id: string;
  game_id: string;
  status: "draft" | "approved" | "rejected";
  photo_id: string | null;
  headline: string | null;
  image_path: string | null;
  published_path: string | null;
  image_version: number;
  sort_order: number;
  generated_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  /** home|away|homeScore|awayScore the image was rendered from; null for banners created before tracking. */
  source_snapshot: string | null;
  /** "auto", "none" or a photo id: what the administrator (or automation) asked for. */
  photo_choice: string;
};

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error });

const draftPath = (gameId: string, version: number) => `${gameId}/v${version}.png`;

async function getRow(bannerId: string): Promise<BannerRow | null> {
  const { data } = await db.from("homepage_banners").select(ROW_COLUMNS).eq("banner_id", bannerId).maybeSingle();
  return (data as BannerRow | null) ?? null;
}

async function removeFiles(bucket: string, paths: Array<string | null | undefined>) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (!list.length) return null;
  const { error } = await db.storage.from(bucket).remove(list);
  return error;
}

export async function listBanners() {
  const { data: rows, error } = await db
    .from("homepage_banners")
    .select(ROW_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return fail(500, error.message);

  const banners = (rows ?? []) as BannerRow[];

  const gameColumns = "game_id, tipoff, season, home_team_id, away_team_id, home_score, away_score";
  const [bannerGames, recentGames, teams] = await Promise.all([
    banners.length
      ? db.from("games").select(gameColumns).in("game_id", banners.map((b) => b.game_id))
      : Promise.resolve({ data: [], error: null }),
    db
      .from("games")
      .select(gameColumns)
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .order("tipoff", { ascending: false })
      .limit(60),
    db.from("teams").select("team_id, team_name"),
  ]);
  if (bannerGames.error) return fail(500, bannerGames.error.message);
  if (recentGames.error) return fail(500, recentGames.error.message);
  if (teams.error) return fail(500, teams.error.message);

  const gameById = new Map((bannerGames.data ?? []).map((g) => [g.game_id as string, g]));

  const draftPaths = banners.map((b) => b.image_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (draftPaths.length) {
    const { data: urls } = await db.storage.from(DRAFTS_BUCKET).createSignedUrls(draftPaths, SIGNED_URL_TTL_SECONDS);
    for (const entry of urls ?? []) if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
  }

  return ok({
    banners: banners.map((b) => {
      const game = gameById.get(b.game_id) ?? null;
      return {
        ...b,
        game,
        // Flagged when the game's teams or score changed since the image was rendered.
        outdated: Boolean(game && b.source_snapshot && gameSnapshot(game) !== b.source_snapshot),
        preview_url: b.image_path ? (signed.get(b.image_path) ?? null) : null,
        published_url: b.published_path ? db.storage.from(PUBLIC_BUCKET).getPublicUrl(b.published_path).data.publicUrl : null,
      };
    }),
    games: recentGames.data ?? [],
    teams: teams.data ?? [],
  });
}

/** Creates the draft for a game, or re-renders its existing draft/rejected banner. Never touches an approved one. */
export async function generateDraft(
  gameId: string,
  options: { headline?: string | null; photo: PhotoChoice }
): Promise<ServiceResult<BannerRow>> {
  // undefined = keep the stored headline; an explicit null or "" clears it (administrator's choice).
  const requested = options.headline === undefined ? undefined : options.headline?.trim() || null;
  if (requested && requested.length > MAX_HEADLINE) return fail(400, `Headline is limited to ${MAX_HEADLINE} characters`);

  const { data: existingData, error: readError } = await db
    .from("homepage_banners")
    .select(ROW_COLUMNS)
    .eq("game_id", gameId)
    .maybeSingle();
  if (readError) return fail(500, readError.message);
  const existing = existingData as BannerRow | null;

  if (existing?.status === "approved") return fail(409, "This banner is published. Unpublish it before regenerating.");

  const headline = requested === undefined ? (existing?.headline ?? null) : requested;

  let png: Buffer;
  let photoId: string | null;
  let snapshot: string;
  try {
    ({ png, photoId, snapshot } = await renderGameBanner(db, gameId, { headline, photo: options.photo }));
  } catch (err) {
    if (err instanceof BannerRenderError) return fail(err.status, err.message);
    return fail(500, err instanceof Error ? err.message : "Banner rendering failed");
  }
  if (png.length > MAX_PNG_BYTES) return fail(500, "Rendered banner exceeds the 5 MB storage limit");

  const version = (existing?.image_version ?? 0) + 1;
  const path = draftPath(gameId, version);

  const { error: uploadError } = await db.storage
    .from(DRAFTS_BUCKET)
    .upload(path, png, { contentType: "image/png", upsert: false });
  if (uploadError) {
    const clash = /exists|duplicate/i.test(uploadError.message);
    return fail(clash ? 409 : 500, clash ? "Another generation is in progress for this game" : uploadError.message);
  }

  const fields = {
    status: "draft" as const,
    photo_id: photoId,
    headline,
    source_snapshot: snapshot,
    photo_choice: options.photo,
    image_path: path,
    image_version: version,
    generated_at: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: null,
  };

  let saved: BannerRow | null = null;
  let dbError: string | null = null;
  let duplicate = false;

  if (existing) {
    // Optimistic lock on image_version + status guard so a concurrent approve/regenerate wins cleanly.
    const { data, error } = await db
      .from("homepage_banners")
      .update(fields)
      .eq("banner_id", existing.banner_id)
      .eq("image_version", existing.image_version)
      .neq("status", "approved")
      .select(ROW_COLUMNS)
      .maybeSingle();
    saved = (data as BannerRow | null) ?? null;
    dbError = error?.message ?? null;
  } else {
    const { data, error } = await db
      .from("homepage_banners")
      .insert({ game_id: gameId, ...fields })
      .select(ROW_COLUMNS)
      .maybeSingle();
    saved = (data as BannerRow | null) ?? null;
    dbError = error?.message ?? null;
    duplicate = error?.code === "23505";
  }

  if (!saved) {
    await removeFiles(DRAFTS_BUCKET, [path]);
    if (duplicate) return fail(409, "A banner for this game was created concurrently.");
    return fail(dbError ? 500 : 409, dbError ?? "The banner changed while generating. Reload and try again.");
  }

  // Old version files are no longer referenced; failures here only leave harmless private orphans.
  if (existing) {
    await removeFiles(DRAFTS_BUCKET, [existing.image_path]);
    if (existing.published_path) {
      const removeError = await removeFiles(PUBLIC_BUCKET, [existing.published_path]);
      if (!removeError) await db.from("homepage_banners").update({ published_path: null }).eq("banner_id", saved.banner_id);
    }
  }

  return ok(saved);
}

/** Copies the draft to the public bucket, and only then flips the row to approved. */
export async function approveBanner(bannerId: string, reviewer: string): Promise<ServiceResult<BannerRow>> {
  const row = await getRow(bannerId);
  if (!row) return fail(404, "Banner not found");
  if (row.status === "approved") return fail(409, "Banner is already published");
  if (!row.image_path) return fail(400, "Banner has no generated image");

  const { data: file, error: downloadError } = await db.storage.from(DRAFTS_BUCKET).download(row.image_path);
  if (downloadError || !file) return fail(500, `Could not read draft: ${downloadError?.message ?? "empty"}`);

  const publishedPath = row.image_path;
  const { error: uploadError } = await db.storage
    .from(PUBLIC_BUCKET)
    .upload(publishedPath, Buffer.from(await file.arrayBuffer()), { contentType: "image/png", upsert: true });
  if (uploadError) return fail(500, `Publishing failed: ${uploadError.message}`);

  // New approvals go to the front of the carousel.
  const { data: first } = await db
    .from("homepage_banners")
    .select("sort_order")
    .eq("status", "approved")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from("homepage_banners")
    .update({
      status: "approved",
      published_path: publishedPath,
      sort_order: first ? first.sort_order - 1 : 0,
      reviewed_by: reviewer,
      reviewed_at: new Date().toISOString(),
    })
    .eq("banner_id", bannerId)
    .eq("image_path", row.image_path)
    .neq("status", "approved")
    .select(ROW_COLUMNS)
    .maybeSingle();

  if (!data) {
    // Never delete a file a concurrent approval just made live.
    const current = await getRow(bannerId);
    if (!(current?.status === "approved" && current.published_path === publishedPath)) {
      await removeFiles(PUBLIC_BUCKET, [publishedPath]);
    }
    return error ? fail(500, error.message) : fail(409, "The banner changed while publishing. Reload and try again.");
  }

  return ok(data as BannerRow);
}

export async function rejectBanner(bannerId: string, reviewer: string): Promise<ServiceResult<BannerRow>> {
  const { data, error } = await db
    .from("homepage_banners")
    .update({ status: "rejected", reviewed_by: reviewer, reviewed_at: new Date().toISOString() })
    .eq("banner_id", bannerId)
    .eq("status", "draft")
    .select(ROW_COLUMNS)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data) return fail(409, "Only draft banners can be rejected");
  return ok(data as BannerRow);
}

/** Hides the banner first, then deletes the public file; published_path is kept until the file is gone so a retry can finish the job. */
export async function unpublishBanner(bannerId: string): Promise<ServiceResult<BannerRow>> {
  const row = await getRow(bannerId);
  if (!row) return fail(404, "Banner not found");
  if (row.status !== "approved" && !row.published_path) return fail(409, "Banner is not published");

  if (row.status === "approved") {
    const { error } = await db
      .from("homepage_banners")
      .update({ status: "draft", reviewed_by: null, reviewed_at: null })
      .eq("banner_id", bannerId)
      .eq("status", "approved");
    if (error) return fail(500, error.message);
  }

  const removeError = await removeFiles(PUBLIC_BUCKET, [row.published_path]);
  if (removeError) {
    return fail(500, `Banner is hidden from the homepage, but its public file could not be deleted (${removeError.message}). Run Unpublish again.`);
  }

  const { data, error } = await db
    .from("homepage_banners")
    .update({ published_path: null })
    .eq("banner_id", bannerId)
    .select(ROW_COLUMNS)
    .maybeSingle();
  if (error || !data) return fail(500, error?.message ?? "Banner not found");
  return ok(data as BannerRow);
}

/** `ids` is the desired carousel order of approved banners (first = shown first). */
export async function reorderApproved(ids: string[]): Promise<ServiceResult<null>> {
  const { data: approved, error } = await db.from("homepage_banners").select("banner_id").eq("status", "approved");
  if (error) return fail(500, error.message);

  const approvedIds = new Set((approved ?? []).map((r) => r.banner_id as string));
  if (new Set(ids).size !== ids.length || ids.some((id) => !approvedIds.has(id))) {
    return fail(409, "Order contains banners that are not published. Reload and try again.");
  }

  const results = await Promise.all(
    ids.map((id, index) =>
      db.from("homepage_banners").update({ sort_order: index }).eq("banner_id", id).eq("status", "approved")
    )
  );
  const failed = results.find((r) => r.error);
  return failed?.error ? fail(500, failed.error.message) : ok(null);
}
