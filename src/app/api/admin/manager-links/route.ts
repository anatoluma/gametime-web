import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { hashToken } from "@/lib/manager-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await supabaseAdmin
    .from("team_access_links")
    .select("id, team_id, expires_at, revoked_at, created_at, teams(team_name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const team_id = typeof body.team_id === "string" ? body.team_id.trim() : "";
  const requestedExpiry = typeof body.expires_at === "string" ? new Date(body.expires_at) : null;
  const expiresAt = requestedExpiry && !Number.isNaN(requestedExpiry.getTime())
    ? requestedExpiry
    : new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);

  if (!team_id) return NextResponse.json({ error: "team_id is required" }, { status: 400 });
  if (expiresAt <= new Date()) return NextResponse.json({ error: "expires_at must be in the future" }, { status: 400 });
  if (expiresAt.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Link expiry cannot be more than 90 days away" }, { status: 400 });
  }

  const { data: team } = await supabaseAdmin.from("teams").select("team_id").eq("team_id", team_id).maybeSingle();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const token = randomBytes(32).toString("base64url");
  const { data, error } = await supabaseAdmin
    .from("team_access_links")
    .insert({ team_id, token_hash: hashToken(token), expires_at: expiresAt.toISOString(), created_by: auth.user.id })
    .select("id, team_id, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  return NextResponse.json({ link: { ...data, url: `${origin}/manage#${token}` } });
}

export async function DELETE(request: Request) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("team_access_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ revoked: true });
}