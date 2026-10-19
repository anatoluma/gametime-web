import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reorderApproved } from "@/lib/banner/service";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/admin/banners/reorder — { ids: string[] } desired carousel order of published banners
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length > 50 || !ids.every((id) => typeof id === "string" && UUID_RE.test(id))) {
    return NextResponse.json({ error: "ids must be an array of banner ids" }, { status: 400 });
  }

  const result = await reorderApproved(ids);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
