import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-only admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gameId = url.searchParams.get("game_id");

  if (!gameId) {  
    return NextResponse.json({ error: "game_id is required" }, { status: 400 });
  }

  const { data: game, error: gameError } = await supabaseAdmin
    .from("games")
    .select("*")
    .eq("game_id", gameId)
    .maybeSingle();

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 });
  }

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const { data: stats, error: statsError } = await supabaseAdmin
    .from("player_game_stats")
    .select("*")
    .eq("game_id", gameId);

  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 500 });
  }

  return NextResponse.json({ game, stats });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { gamePayload, homePlayers, awayPlayers, editingGameId } = body;

  if (!gamePayload || !homePlayers || !awayPlayers) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const gameId = editingGameId || gamePayload.game_id;
  if (!gameId) {
    return NextResponse.json({ error: "game_id is required" }, { status: 400 });
  }

  const { data: game, error: gameError } = await supabaseAdmin
    .from("games")
    .upsert({ ...gamePayload, game_id: gameId }, { onConflict: "game_id" })
    .select()
    .maybeSingle();

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 });
  }

  if (!game) {
    return NextResponse.json({ error: "Failed to create/update game" }, { status: 500 });
  }

  if (editingGameId) {
    const { error: deleteError } = await supabaseAdmin
      .from("player_game_stats")
      .delete()
      .eq("game_id", gameId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  const allStats = [...homePlayers, ...awayPlayers]
    .filter((p: any) => p.played)
    .map((p: any) => ({
      game_id: gameId,
      player_id: p.player_id,
      points: p.points,
      team_id: p.team_id,
    }));

  const { error: statsError2 } = await supabaseAdmin
    .from("player_game_stats")
    .insert(allStats);

  if (statsError2) {
    return NextResponse.json({ error: statsError2.message }, { status: 500 });
  }

  return NextResponse.json({ game });
}
