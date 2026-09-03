import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RouteContext = {
  params: Promise<{ player_id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { player_id: playerId } = await params;

  const { data: stats, error: statsError } = await supabaseAdmin
    .from("player_game_stats")
    .select("game_id, points, reb_tot, assists")
    .eq("player_id", playerId);

  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 500 });
  }

  const gameIds = Array.from(new Set((stats ?? []).map((stat) => stat.game_id)));
  if (gameIds.length === 0) {
    return NextResponse.json({ stats: [], games: [] });
  }

  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("game_id, season, tipoff, home_team_id, away_team_id, home_score, away_score")
    .in("game_id", gameIds);

  if (gamesError) {
    return NextResponse.json({ error: gamesError.message }, { status: 500 });
  }

  return NextResponse.json({ stats: stats ?? [], games: games ?? [] });
}