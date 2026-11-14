import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveTeamId } from "@/lib/team-codes";
import { registerReviewPlayer } from "@/lib/review-registration";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
