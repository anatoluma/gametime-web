import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireTeamManager } from "@/lib/manager-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/manager/me — teams the caller manages
export async function GET(request: Request) {
  const auth = await requireTeamManager(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("teams")
    .select("team_id, team_name")
    .in("team_id", auth.teamIds)
    .order("team_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ teams: data ?? [] });
}
