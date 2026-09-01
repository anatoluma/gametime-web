import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season");

  if (season) {
    const { data, error } = await supabaseAdmin
      .from("team_seasons")
      .select(`team_id, season, is_active, teams (team_id, team_name, city, coach)`)
      .eq("season", season)
      .order("team_id");

    if (error) {
      if (error.message?.toLowerCase().includes("does not exist")) {
        return NextResponse.json({ teams: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (data ?? []).map((row: any) => ({
      team_id: row.team_id,
      team_name: row.teams?.team_name ?? null,
      city: row.teams?.city ?? null,
      coach: row.teams?.coach ?? null,
      is_active: row.is_active ?? true,
    }));

    return NextResponse.json({ teams: mapped });
  }

  const { data, error } = await supabaseAdmin
    .from("teams")
    .select("team_id, team_name, city, coach, is_active")
    .order("team_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ teams: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body?.action === "migrate_from_previous_season") {
    const { source_season, target_season } = body ?? {};

    if (!source_season || !target_season) {
      return NextResponse.json({ error: "source_season and target_season are required" }, { status: 400 });
    }

    const { data: priorTeams, error: fetchError } = await supabaseAdmin
      .from("team_seasons")
      .select("team_id, is_active, teams (team_id, team_name, city, coach)")
      .eq("season", source_season)
      .eq("is_active", true);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const rows = (priorTeams ?? []).map((team: any) => ({
      team_id: team.team_id,
      season: target_season,
      is_active: true,
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("team_seasons")
      .upsert(rows, { onConflict: "team_id,season" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ migrated: rows.length, target_season });
  }

  const season = body?.season ? String(body.season).trim() : "";
  const team_id = String(body?.team_id ?? "").trim().toUpperCase();
  const team_name = String(body?.team_name ?? "").trim();
  const city = body?.city == null || String(body.city).trim() === "" ? null : String(body.city).trim();
  const coach = body?.coach == null || String(body.coach).trim() === "" ? null : String(body.coach).trim();
  const is_active = body?.is_active ?? true;

  if (!team_id || !team_name) {
    return NextResponse.json({ error: "team_id and team_name are required" }, { status: 400 });
  }

  const { data: teamData, error: teamError } = await supabaseAdmin
    .from("teams")
    .upsert(
      {
        team_id,
        team_name,
        city,
        coach,
        is_active: Boolean(is_active),
      },
      { onConflict: "team_id" }
    )
    .select()
    .single();

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  if (season) {
    const { data: seasonData, error: seasonError } = await supabaseAdmin
      .from("team_seasons")
      .upsert(
        {
          team_id,
          season,
          is_active: Boolean(is_active),
        },
        { onConflict: "team_id,season" }
      )
      .select()
      .single();

    if (seasonError) {
      return NextResponse.json({ error: seasonError.message }, { status: 500 });
    }

    return NextResponse.json({ team: { ...teamData, ...seasonData, is_active: Boolean(is_active) } });
  }

  return NextResponse.json({ team: teamData });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const team_id = String(body?.team_id ?? "").trim();
  const season = body?.season ? String(body.season).trim() : "";

  if (!team_id) {
    return NextResponse.json({ error: "team_id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if ("team_name" in body) updates.team_name = body.team_name == null || String(body.team_name).trim() === "" ? null : String(body.team_name).trim();
  if ("city" in body) updates.city = body.city == null || String(body.city).trim() === "" ? null : String(body.city).trim();
  if ("coach" in body) updates.coach = body.coach == null || String(body.coach).trim() === "" ? null : String(body.coach).trim();
  if ("is_active" in body) updates.is_active = Boolean(body.is_active);

  if (!season && Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid team fields to update" }, { status: 400 });
  }

  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabaseAdmin
      .from("teams")
      .update(updates)
      .eq("team_id", team_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!season) {
      return NextResponse.json({ team: data });
    }
  }

  if (season) {
    const seasonUpdates: Record<string, unknown> = {};
    if ("is_active" in body) seasonUpdates.is_active = Boolean(body.is_active);

    if (Object.keys(seasonUpdates).length === 0) {
      return NextResponse.json({ error: "No valid season team fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("team_seasons")
      .update(seasonUpdates)
      .eq("team_id", team_id)
      .eq("season", season)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ team: data });
  }

  return NextResponse.json({ team: null });
}
