import { NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type SupabaseUserResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

/**
 * Verifies the caller holds a valid Supabase session, sent as
 * `Authorization: Bearer <access_token>`. Shared by `requireAdmin` and
 * `requireTeamManager` (`src/lib/manager-auth.ts`).
 */
export async function verifySupabaseUser(request: Request): Promise<SupabaseUserResult> {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true, user };
}

export type AdminAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

/**
 * Verifies the caller holds a valid Supabase session. Use `adminFetch` on the
 * client.
 *
 * Any authenticated user counts as an admin: `src/app/login/page.tsx` calls
 * signInWithOtp with `shouldCreateUser: false`, so auth.users is itself the
 * allowlist — accounts can only be created from the Supabase dashboard.
 * Set ADMIN_EMAILS (comma-separated) to narrow it further.
 */
export async function requireAdmin(request: Request): Promise<AdminAuthResult> {
  const verified = await verifySupabaseUser(request);
  if (!verified.ok) return verified;

  const { user } = verified;

  const allowed = process.env.ADMIN_EMAILS?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (allowed?.length && !allowed.includes((user.email ?? "").toLowerCase())) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, user };
}
