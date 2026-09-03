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

  if (jerseyNum !== null && (!Number.isInteger(jerseyNum) || jerseyNum < 0 || jerseyNum > 99)) {
    return NextResponse.json({ error: "Jersey number must be a whole number from 0 to 99" }, { status: 400 });
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

// PATCH /api/manager/roster — update the current-season roster and canonical player name
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
    .select("team_id, jersey_number, is_active")
    .eq("player_id", player_id)
    .eq("season", season)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing || !auth.teamIds.includes(existing.team_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed: Record<string, unknown> = {};
  if ("jersey_number" in updates) {
    const jerseyNumber = updates.jersey_number === null || updates.jersey_number === "" ? null : Number(updates.jersey_number);
    if (jerseyNumber !== null && (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 99)) {
      return NextResponse.json({ error: "Jersey number must be a whole number from 0 to 99" }, { status: 400 });
    }
    allowed.jersey_number = jerseyNumber;
  }
  if ("is_active" in updates) {
    if (typeof updates.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be boolean" }, { status: 400 });
    }
    allowed.is_active = updates.is_active;
  }

  const firstName = "first_name" in updates ? (typeof updates.first_name === "string" ? updates.first_name.trim() : null) : undefined;
  const lastName = "last_name" in updates ? (typeof updates.last_name === "string" ? updates.last_name.trim() : null) : undefined;
  if ("first_name" in updates && firstName === null) {
    return NextResponse.json({ error: "first_name must be text" }, { status: 400 });
  }
  if ("last_name" in updates && (!lastName || lastName.length === 0)) {
    return NextResponse.json({ error: "last_name is required" }, { status: 400 });
  }

  const nextJersey = "jersey_number" in allowed ? allowed.jersey_number : existing.jersey_number;
  const nextActive = "is_active" in allowed ? allowed.is_active : existing.is_active;
  if (nextActive === true && nextJersey !== null) {
    const { data: conflict, error: conflictError } = await supabaseAdmin
      .from("player_seasons")
      .select("player_id")
      .eq("season", season)
      .eq("team_id", existing.team_id)
      .eq("jersey_number", nextJersey)
      .eq("is_active", true)
      .neq("player_id", player_id)
      .maybeSingle();
    if (conflictError) return NextResponse.json({ error: conflictError.message }, { status: 500 });
    if (conflict) return NextResponse.json({ error: "That jersey number is already assigned to an active player" }, { status: 409 });
  }

  if (Object.keys(allowed).length === 0) {
    if (firstName === undefined && lastName === undefined) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
  }

  const { data, error } = Object.keys(allowed).length > 0
    ? await supabaseAdmin
      .from("player_seasons")
      .update(allowed)
      .eq("player_id", player_id)
      .eq("season", season)
      .select()
      .single()
    : { data: existing, error: null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (firstName !== undefined || lastName !== undefined || "jersey_number" in allowed) {
    const playerUpdate: Record<string, unknown> = {};
    if (firstName !== undefined) playerUpdate.first_name = firstName;
    if (lastName !== undefined) playerUpdate.last_name = lastName;
    if ("jersey_number" in allowed) playerUpdate.jersey_number = allowed.jersey_number;
    const { error: playerError } = await supabaseAdmin.from("players").update(playerUpdate).eq("player_id", player_id);
    if (playerError) return NextResponse.json({ error: playerError.message }, { status: 500 });
  }

  return NextResponse.json({ player_season: data });
}
