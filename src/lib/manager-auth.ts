import { NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { verifySupabaseUser } from "@/lib/admin-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ManagerAuthResult =
  | { ok: true; user: User | null; teamIds: string[] }
  | { ok: false; response: NextResponse };

const LINK_COOKIE = "team_manager_token";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request: Request, name: string): string | null {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function findLinkTeam(token: string): Promise<string[] | null> {
  const { data, error } = await supabaseAdmin
    .from("team_access_links")
    .select("team_id")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ team_id: string }>();

  if (error || !data) return null;
  return [data.team_id];
}

/**
 * Verifies the caller holds a valid Supabase session and manages at least one
 * team (via the `team_managers` table). Use `adminFetch` on the client — it's
 * a generic Bearer-attaching fetch wrapper, not admin-specific.
 */
export async function requireTeamManager(request: Request): Promise<ManagerAuthResult> {
  const authorization = request.headers.get("authorization");
  if (authorization) {
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

  const token = readCookie(request, LINK_COOKIE);
  const teamIds = token ? await findLinkTeam(token) : null;
  if (!teamIds) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true, user: null, teamIds };
}

export { LINK_COOKIE, hashToken };
