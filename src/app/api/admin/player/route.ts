import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { createManualPlayer } from "@/lib/manual-player";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { team_id, first_name, last_name, jersey_number, season } = body ?? {};

  if (!team_id || !first_name || !last_name) {
    return NextResponse.json(
      { error: "team_id, first_name, and last_name are required" },
      { status: 400 }
    );
  }
  if (typeof season !== "string" || !/^\d{4}\/\d{2}$/.test(season.trim())) {
    return NextResponse.json({ error: "A valid game season is required" }, { status: 400 });
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
    (payload.jersey_number !== null &&
      (!Number.isInteger(payload.jersey_number) || payload.jersey_number < 0 || payload.jersey_number > 32767))
  ) {
    return NextResponse.json({ error: "Invalid player values" }, { status: 400 });
  }

  try {
    const player = await createManualPlayer(supabaseAdmin, payload, season.trim());
    return NextResponse.json({ player });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create player" }, { status: 500 });
  }
}
