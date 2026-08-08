import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET  /api/admin/players/seasons?season=2025%2F26
// POST /api/admin/players/seasons  — upsert one row OR bulk-copy from previous season

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season");

  if (!season) {
    return NextResponse.json({ error: "season query param required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("player_seasons")
    .select(`
      player_id,
      season,
      team_id,
      jersey_number,
      is_active,
      players ( first_name, last_name ),
      teams ( team_name )
    `)
    .eq("season", season)
    .order("team_id")
    .order("jersey_number");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ player_seasons: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();

  // Bulk copy: copy all player_seasons from source_season into target_season
  if (body?.action === "copy_season") {
    const { source_season, target_season } = body;
    if (!source_season || !target_season) {
      return NextResponse.json({ error: "source_season and target_season required" }, { status: 400 });
    }

    const { data: source, error: fetchErr } = await supabaseAdmin
      .from("player_seasons")
      .select("player_id, team_id, jersey_number")
      .eq("season", source_season);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!source || source.length === 0) {
      return NextResponse.json({ error: "No players found in source season" }, { status: 404 });
    }

    const rows = source.map((r) => ({
      player_id: r.player_id,
      season: target_season,
      team_id: r.team_id,
      jersey_number: r.jersey_number,
      is_active: true,
    }));

    const { error: insertErr } = await supabaseAdmin
      .from("player_seasons")
      .upsert(rows, { onConflict: "player_id,season", ignoreDuplicates: true });

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json({ copied: rows.length });
  }

  // Single upsert: { player_id, season, team_id, jersey_number?, is_active? }
  const { player_id, season, team_id, jersey_number, is_active } = body ?? {};
  if (!player_id || !season || !team_id) {
    return NextResponse.json({ error: "player_id, season, and team_id are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("player_seasons")
    .upsert(
      {
        player_id,
        season,
        team_id,
        jersey_number: jersey_number ?? null,
        is_active: is_active ?? true,
      },
      { onConflict: "player_id,season" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ player_season: data });
}

// PATCH /api/admin/players/seasons — update a single player_season row
export async function PATCH(request: Request) {
  const body = await request.json();
  const { player_id, season, ...updates } = body ?? {};

  if (!player_id || !season) {
    return NextResponse.json({ error: "player_id and season are required" }, { status: 400 });
  }

  const allowed: Record<string, unknown> = {};
  if ("team_id" in updates) allowed.team_id = updates.team_id;
  if ("jersey_number" in updates) allowed.jersey_number = updates.jersey_number;
  if ("is_active" in updates) allowed.is_active = updates.is_active;

  const { data, error } = await supabaseAdmin
    .from("player_seasons")
    .update(allowed)
    .eq("player_id", player_id)
    .eq("season", season)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ player_season: data });
}
