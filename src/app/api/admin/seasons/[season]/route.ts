import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH /api/admin/seasons/[season]
// Body: { is_current: true } — marks this season as current, clears all others
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ season: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { season: rawSeason } = await params;
  const season = decodeURIComponent(rawSeason);
  const body = await request.json();

  if (body?.is_current !== true) {
    return NextResponse.json({ error: "Only { is_current: true } is supported" }, { status: 400 });
  }

  // Confirm the target exists before clearing the flag. Otherwise a bad label
  // leaves the league with no current season at all.
  const { data: target, error: lookupError } = await supabaseAdmin
    .from("seasons")
    .select("season")
    .eq("season", season)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });

  if (!target) {
    return NextResponse.json(
      { error: `Unknown season ${season}`, code: "SEASON_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Clear existing current flag, then set the new one (two steps — unique partial index prevents both being true)
  const { error: clearError } = await supabaseAdmin
    .from("seasons")
    .update({ is_current: false })
    .eq("is_current", true);

  if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("seasons")
    .update({ is_current: true })
    .eq("season", season)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ season: data });
}
