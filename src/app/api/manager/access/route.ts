import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashToken, LINK_COOKIE } from "@/lib/manager-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("team_access_links")
    .select("id, team_id, expires_at")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ id: string; team_id: string; expires_at: string }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "This link is invalid or expired" }, { status: 401 });

  const response = NextResponse.json({ team_id: data.team_id });
  response.cookies.set(LINK_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(data.expires_at),
    path: "/",
  });
  return response;
}
