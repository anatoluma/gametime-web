import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchSeasonRoster } from "@/lib/season-roster";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const season = params.get("season")?.trim() ?? "";
  const teamIds = params.getAll("team_id").map((id) => id.trim());
  if (!/^\d{4}\/\d{2}$/.test(season) || teamIds.length !== 2 || teamIds.some((id) => !id || id.length > 100)) {
    return NextResponse.json({ error: "A valid season and two teams are required." }, { status: 400 });
  }

  try {
    const roster = await fetchSeasonRoster(supabaseAdmin, season, teamIds);
    return NextResponse.json({ roster });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load season rosters." },
      { status: 500 }
    );
  }
}
