import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { createManualPlayer, findManualJerseyConflict, ManualPlayerRegistrationConflict, reassignManualJersey } from "@/lib/manual-player";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { team_id, first_name, last_name, jersey_number, season, replace_jersey_for, use_existing_player } = body ?? {};

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
  if (use_existing_player && (typeof use_existing_player !== "string" || replace_jersey_for || payload.jersey_number === null)) {
    return NextResponse.json({ error: "Invalid existing player selection" }, { status: 400 });
  }

  try {
    if (payload.jersey_number !== null) {
      const conflict = await findManualJerseyConflict(supabaseAdmin, season.trim(), payload.team_id, payload.jersey_number);
      if (conflict && conflict.player_id !== replace_jersey_for) {
        if (use_existing_player === conflict.player_id) {
          return NextResponse.json({ player: { ...conflict, team_id: payload.team_id } });
        }
        return NextResponse.json({ error: "Jersey number is already assigned.", conflict }, { status: 409 });
      }
      if (use_existing_player) {
        return NextResponse.json({ error: "The jersey assignment changed. Check the conflict again." }, { status: 409 });
      }
      if (replace_jersey_for) {
        if (typeof replace_jersey_for !== "string" || !conflict) {
          return NextResponse.json({ error: "The jersey assignment changed. Check the conflict again." }, { status: 409 });
        }
        const player = await reassignManualJersey(supabaseAdmin, payload, season.trim(), replace_jersey_for);
        return NextResponse.json({ player });
      }
    } else if (replace_jersey_for) {
      return NextResponse.json({ error: "A jersey number is required for reassignment." }, { status: 400 });
    }
    const player = await createManualPlayer(supabaseAdmin, payload, season.trim());
    return NextResponse.json({ player });
  } catch (error) {
    if (error instanceof ManualPlayerRegistrationConflict && payload.jersey_number !== null) {
      try {
        const conflict = await findManualJerseyConflict(supabaseAdmin, season.trim(), payload.team_id, payload.jersey_number);
        if (conflict) return NextResponse.json({ error: "Jersey number is already assigned.", conflict }, { status: 409 });
      } catch (lookupError) {
        return NextResponse.json({ error: `${error.message}. Could not recheck jersey: ${lookupError instanceof Error ? lookupError.message : "Unknown error"}` }, { status: 500 });
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create player" }, { status: 500 });
  }
}
