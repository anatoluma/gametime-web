import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { generateDraft, listBanners } from "@/lib/banner/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/admin/banners — banners with game info, signed draft preview URLs and recent completed games
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const result = await listBanners();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}

// POST /api/admin/banners — { game_id, headline?, photo?: "auto" | "none" | <photo_id> }
// Creates the game's draft, or re-renders it if one exists (idempotent per game).
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const photo = body?.photo ?? "auto";

  if (!body || typeof body.game_id !== "string" || !body.game_id.trim()) {
    return NextResponse.json({ error: "game_id is required" }, { status: 400 });
  }
  if (body.headline != null && typeof body.headline !== "string") {
    return NextResponse.json({ error: "headline must be a string" }, { status: 400 });
  }
  if (photo !== "auto" && photo !== "none" && !(typeof photo === "string" && UUID_RE.test(photo))) {
    return NextResponse.json({ error: "photo must be 'auto', 'none' or a photo id" }, { status: 400 });
  }

  const result = await generateDraft(body.game_id.trim(), { headline: body.headline, photo });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ banner: result.data });
}
