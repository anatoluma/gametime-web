import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeSeasonLabel } from "@/lib/league";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("seasons")
    .select("season, is_current, label, start_date")
    .order("season", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seasons: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { season, label, start_date } = body ?? {};

  if (!season || typeof season !== "string") {
    return NextResponse.json({ error: "season is required (e.g. '2026/27')" }, { status: 400 });
  }

  // Canonicalize to "YYYY/YY" — anything else would never match games.season.
  const normalized = normalizeSeasonLabel(season);

  if (!/^\d{4}\/\d{2}$/.test(normalized)) {
    return NextResponse.json(
      { error: `Season must look like "2026/27" (got "${season}")`, code: "INVALID_SEASON_LABEL" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("seasons")
    .insert({ season: normalized, label: label ?? null, start_date: start_date ?? null, is_current: false })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Season ${normalized} already exists`, code: "SEASON_EXISTS" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ season: data });
}
