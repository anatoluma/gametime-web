import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { resolveTeamId } from "@/lib/team-codes";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { first_name, last_name, team_code, jersey_number } = body;

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
