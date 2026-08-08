import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const { season } = await params;
  const body = await request.json();

  if (body?.is_current !== true) {
    return NextResponse.json({ error: "Only { is_current: true } is supported" }, { status: 400 });
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
    .eq("season", decodeURIComponent(season))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ season: data });
}
