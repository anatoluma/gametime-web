import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
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
  const team_id = String(body?.team_id ?? "").trim().toUpperCase();
  const team_name = String(body?.team_name ?? "").trim();
  const city = body?.city == null || String(body.city).trim() === "" ? null : String(body.city).trim();
  const coach = body?.coach == null || String(body.coach).trim() === "" ? null : String(body.coach).trim();
  const is_active = body?.is_active ?? true;

  if (!team_id || !team_name) {
    return NextResponse.json({ error: "team_id and team_name are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ team: data });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const team_id = String(body?.team_id ?? "").trim();

  if (!team_id) {
    return NextResponse.json({ error: "team_id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if ("team_name" in body) updates.team_name = body.team_name == null || String(body.team_name).trim() === "" ? null : String(body.team_name).trim();
  if ("city" in body) updates.city = body.city == null || String(body.city).trim() === "" ? null : String(body.city).trim();
  if ("coach" in body) updates.coach = body.coach == null || String(body.coach).trim() === "" ? null : String(body.coach).trim();
  if ("is_active" in body) updates.is_active = Boolean(body.is_active);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid team fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("teams")
    .update(updates)
    .eq("team_id", team_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ team: data });
}
