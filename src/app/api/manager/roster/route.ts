import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { requireTeamManager } from "@/lib/manager-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCurrentSeason(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("seasons")
    .select("season")
    .eq("is_current", true)
    .maybeSingle();

  return data?.season ?? null;
}

// GET /api/manager/roster?team_id=X — current-season roster for one of the caller's teams
export async function GET(request: Request) {
  const auth = await requireTeamManager(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const team_id = searchParams.get("team_id");

  if (!team_id) {
    return NextResponse.json({ error: "team_id query param required" }, { status: 400 });
  }
  if (!auth.teamIds.includes(team_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const season = await getCurrentSeason();
  if (!season) {
    return NextResponse.json({ error: "No current season is set" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("player_seasons")
    .select(`
      player_id,
      season,
      team_id,
      jersey_number,
      is_active,
      players ( first_name, last_name, photo_url )
    `)
    .eq("season", season)
    .eq("team_id", team_id)
    .order("jersey_number");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ season, player_seasons: data ?? [] });
}

// POST /api/manager/roster — add a new player to the caller's team roster
export async function POST(request: Request) {
  const auth = await requireTeamManager(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { first_name, last_name, team_id, jersey_number } = body;

  if (typeof team_id !== "string" || !auth.teamIds.includes(team_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!last_name || typeof last_name !== "string" || !last_name.trim()) {
    return NextResponse.json({ error: "last_name is required" }, { status: 400 });
  }

  const jerseyNum =
    jersey_number === null || jersey_number === undefined || jersey_number === ""
      ? null
      : Number(jersey_number);

  if (jerseyNum !== null && !Number.isFinite(jerseyNum)) {
    return NextResponse.json({ error: "Invalid jersey_number" }, { status: 400 });
  }

  const season = await getCurrentSeason();
  if (!season) {
    return NextResponse.json({ error: "No current season is set" }, { status: 500 });
  }

  const { data: player, error: insertError } = await supabaseAdmin
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

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: playerSeason, error: seasonError } = await supabaseAdmin
    .from("player_seasons")
    .insert({
      player_id: player.player_id,
      season,
      team_id,
      jersey_number: jerseyNum,
      is_active: true,
    })
    .select()
    .single();

  if (seasonError) {
    return NextResponse.json({ error: seasonError.message }, { status: 500 });
  }

  return NextResponse.json({ player_season: playerSeason });
}

// PATCH /api/manager/roster — update jersey_number/is_active for one player_season row
export async function PATCH(request: Request) {
  const auth = await requireTeamManager(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { player_id, season, ...updates } = body ?? {};

  if (!player_id || !season) {
    return NextResponse.json({ error: "player_id and season are required" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("player_seasons")
    .select("team_id")
    .eq("player_id", player_id)
    .eq("season", season)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing || !auth.teamIds.includes(existing.team_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed: Record<string, unknown> = {};
  if ("jersey_number" in updates) allowed.jersey_number = updates.jersey_number;
  if ("is_active" in updates) allowed.is_active = updates.is_active;

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

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
