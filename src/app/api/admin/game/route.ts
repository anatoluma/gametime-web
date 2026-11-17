import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeSeasonLabel } from "@/lib/league";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeYouTubeUrl } from "@/lib/youtube";
import { prepareManualGameUpsert } from "@/lib/game-provenance";

// Server-only admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

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

// Updates only the YouTube link; an empty value clears it.
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { game_id?: unknown; youtube_url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.game_id !== "string" || !body.game_id) {
    return NextResponse.json({ error: "game_id is required" }, { status: 400 });
  }

  const raw = typeof body.youtube_url === "string" ? body.youtube_url.trim() : "";
  const youtubeUrl = raw ? normalizeYouTubeUrl(raw) : null;
  if (raw && !youtubeUrl) {
    return NextResponse.json({ error: "Invalid YouTube link" }, { status: 422 });
  }

  const { data, error } = await supabaseAdmin
    .from("games")
    .update({ youtube_url: youtubeUrl })
    .eq("game_id", body.game_id)
    .select("game_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json({ game_id: data.game_id, youtube_url: youtubeUrl });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const gameId = url.searchParams.get("game_id");

  if (!gameId) {
    return NextResponse.json({ error: "game_id is required" }, { status: 400 });
  }

  // Delete player stats first (foreign key constraint)
  const { error: statsError } = await supabaseAdmin
    .from("player_game_stats")
    .delete()
    .eq("game_id", gameId);

  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 500 });
  }

  // Delete the game
  const { error: gameError } = await supabaseAdmin
    .from("games")
    .delete()
    .eq("game_id", gameId);

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 });
  }

  return NextResponse.json({ message: "Game deleted successfully" });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { gamePayload, homePlayers, awayPlayers, editingGameId } = body;

  if (!gamePayload || typeof gamePayload !== "object" || !Array.isArray(homePlayers) || !Array.isArray(awayPlayers)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const gameId = editingGameId || gamePayload.game_id;
  if (typeof gameId !== "string" || !gameId) {
    return NextResponse.json({ error: "game_id is required" }, { status: 400 });
  }
  if (!editingGameId && (gamePayload.home_score == null || gamePayload.away_score == null)) {
    return NextResponse.json({ error: "Both scores are required for a new game." }, { status: 400 });
  }

  const normalizedGamePayload = {
    ...gamePayload,
    ...(typeof gamePayload.season === "string" ? { season: normalizeSeasonLabel(gamePayload.season) } : {}),
  };
  const gameWritePayload = prepareManualGameUpsert(normalizedGamePayload, gameId, Boolean(editingGameId));

  const stats = [...homePlayers, ...awayPlayers].filter(
    (player: { played?: boolean }) => player.played
  );
  const { data: result, error } = await supabaseAdmin.rpc("save_manual_game", {
    p_game: gameWritePayload,
    p_stats: stats,
    p_edit: Boolean(editingGameId),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (result?.status === "not_found") {
    return NextResponse.json({ error: "Game not found; reload and select an existing game to edit." }, { status: 404 });
  }
  if (result?.status === "conflict") {
    return NextResponse.json({ error: "This game already exists and is not an unplayed scheduled game. Select it in edit mode instead." }, { status: 409 });
  }
  if (result?.status !== "ok" || !result.game) {
    return NextResponse.json({ error: "Failed to create/update game" }, { status: 500 });
  }

  return NextResponse.json({ game: result.game });
}
