import { NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/admin-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ManagerAuthResult =
  | { ok: true; user: User; teamIds: string[] }
  | { ok: false; response: NextResponse };

/**
 * Verifies the caller holds a valid Supabase session and manages at least one
 * team (via the `team_managers` table). Use `adminFetch` on the client — it's
 * a generic Bearer-attaching fetch wrapper, not admin-specific.
 */
export async function requireTeamManager(request: Request): Promise<ManagerAuthResult> {
  const verified = await verifySupabaseUser(request);
  if (!verified.ok) return verified;

  const { user } = verified;

  const { data, error } = await supabaseAdmin
    .from("team_managers")
    .select("team_id")
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }

  const teamIds = (data ?? []).map((row) => row.team_id);

  if (teamIds.length === 0) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, user, teamIds };
}
