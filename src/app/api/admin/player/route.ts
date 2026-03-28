import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.json();
  const { team_id, first_name, last_name, jersey_number } = body ?? {};

  if (!team_id || !first_name || !last_name) {
    return NextResponse.json(
      { error: "team_id, first_name, and last_name are required" },
      { status: 400 }
    );
  }

  const payload = {
    player_id: randomUUID(),
    team_id: String(team_id).trim(),
    first_name: String(first_name).trim(),
    last_name: String(last_name).trim(),
    jersey_number:
      jersey_number === null || jersey_number === undefined || jersey_number === ""
        ? null
        : Number(jersey_number),
  };

  if (
    payload.first_name.length === 0 ||
    payload.last_name.length === 0 ||
    (payload.jersey_number !== null && Number.isNaN(payload.jersey_number))
  ) {
    return NextResponse.json({ error: "Invalid player values" }, { status: 400 });
  }

  const { data: player, error } = await supabaseAdmin
    .from("players")
    .insert(payload)
    .select("player_id, team_id, first_name, last_name, jersey_number")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ player });
}
