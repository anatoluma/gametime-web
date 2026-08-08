import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("seasons")
    .select("season, is_current, label, start_date")
    .order("season", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seasons: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { season, label, start_date } = body ?? {};

  if (!season || typeof season !== "string") {
    return NextResponse.json({ error: "season is required (e.g. '2026/27')" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("seasons")
    .insert({ season: season.trim(), label: label ?? null, start_date: start_date ?? null, is_current: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ season: data });
}
