import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { resolveTeamId } from "@/lib/team-codes";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const team_code = searchParams.get("team_code");
  const jersey_number = searchParams.get("jersey_number");

  if (!team_code || !jersey_number) {
    return NextResponse.json({ existing: null });
  }

  const teamCode = team_code.trim().toUpperCase();
  const team_id = resolveTeamId(teamCode);
  if (!team_id) {
    return NextResponse.json({ existing: null });
  }

  const jerseyNum = Number(jersey_number);
  if (!Number.isFinite(jerseyNum)) {
    return NextResponse.json({ existing: null });
  }

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("player_id, first_name, last_name, jersey_number")
    .eq("team_id", team_id)
    .eq("jersey_number", jerseyNum)
    .maybeSingle<{ player_id: string; first_name: string | null; last_name: string; jersey_number: number }>();

  if (!player) {
    return NextResponse.json({ existing: null });
  }

  return NextResponse.json({
    existing: {
      player_id: player.player_id,
      first_name: player.first_name,
      last_name: player.last_name,
      jersey_number: player.jersey_number,
    },
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { first_name, last_name, team_code, jersey_number, clear_existing_jersey } = body;

  if (!last_name || typeof last_name !== "string" || !last_name.trim()) {
    return NextResponse.json({ error: "last_name is required" }, { status: 400 });
  }

  const teamCode = typeof team_code === "string" ? team_code.trim().toUpperCase() : null;
  const team_id = resolveTeamId(teamCode);
  if (!team_id) {
    return NextResponse.json(
      { error: `Cannot resolve team from code "${team_code ?? ""}"` },
      { status: 400 }
    );
  }

  const jerseyNum =
    jersey_number === null || jersey_number === undefined || jersey_number === ""
      ? null
      : Number(jersey_number);

  if (jerseyNum !== null && !Number.isFinite(jerseyNum)) {
    return NextResponse.json({ error: "Invalid jersey_number" }, { status: 400 });
  }

  if (jerseyNum !== null) {
    const { data: conflictPlayer } = await supabaseAdmin
      .from("players")
      .select("player_id, first_name, last_name")
      .eq("team_id", team_id)
      .eq("jersey_number", jerseyNum)
      .maybeSingle<{ player_id: string; first_name: string | null; last_name: string }>();

    if (conflictPlayer) {
      if (clear_existing_jersey === true) {
        const { error: clearError } = await supabaseAdmin
          .from("players")
          .update({ jersey_number: null })
          .eq("player_id", conflictPlayer.player_id);
        if (clearError) {
          return NextResponse.json(
            { error: `Failed to clear existing player jersey: ${clearError.message}` },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          {
            conflict: true,
            existing: {
              player_id: conflictPlayer.player_id,
              first_name: conflictPlayer.first_name,
              last_name: conflictPlayer.last_name,
              jersey_number: jerseyNum,
            },
          },
          { status: 409 }
        );
      }
    }
  }

  const { data: player, error } = await supabaseAdmin
    .from("players")
    .insert({
      player_id: randomUUID(),
      team_id,
      first_name: typeof first_name === "string" && first_name.trim() ? first_name.trim() : null,
      last_name: last_name.trim(),
      jersey_number: jerseyNum,
    })
    .select("player_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ player_id: player.player_id });
}
