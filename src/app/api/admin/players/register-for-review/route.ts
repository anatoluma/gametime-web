import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveTeamId } from "@/lib/team-codes";
import { registerReviewPlayer } from "@/lib/review-registration";
import { fetchUnregisteredReviewPlayers } from "@/lib/season-roster";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const season = params.get("season")?.trim() ?? "";
  const teamId = resolveTeamId(params.get("team_code"));
  if (!/^\d{4}\/\d{2}$/.test(season) || !teamId) {
    return NextResponse.json({ error: "A valid season and team are required." }, { status: 400 });
  }
  try {
    const players = await fetchUnregisteredReviewPlayers(supabaseAdmin, season, [teamId]);
    return NextResponse.json({ players });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load existing players." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { player_id?: unknown; season?: unknown; team_code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const playerId = typeof body?.player_id === "string" ? body.player_id.trim() : "";
  const season = typeof body?.season === "string" ? body.season.trim() : "";
  const teamId = resolveTeamId(typeof body?.team_code === "string" ? body.team_code : null);
  if (!playerId || !/^\d{4}\/\d{2}$/.test(season) || !teamId) {
    return NextResponse.json({ error: "A player, game season, and valid team are required." }, { status: 400 });
  }

  const result = await registerReviewPlayer(supabaseAdmin, playerId, season, teamId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ player_id: playerId });
}
