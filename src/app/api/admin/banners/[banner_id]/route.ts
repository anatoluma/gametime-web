import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { approveBanner, rejectBanner, unpublishBanner } from "@/lib/banner/service";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/admin/banners/:banner_id — { action: "approve" | "reject" | "unpublish" }
export async function POST(request: Request, { params }: { params: Promise<{ banner_id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { banner_id } = await params;
  if (!UUID_RE.test(banner_id)) return NextResponse.json({ error: "Invalid banner id" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const reviewer = auth.user.email ?? auth.user.id;

  const result =
    body?.action === "approve"
      ? await approveBanner(banner_id, reviewer)
      : body?.action === "reject"
        ? await rejectBanner(banner_id, reviewer)
        : body?.action === "unpublish"
          ? await unpublishBanner(banner_id)
          : null;

  if (!result) return NextResponse.json({ error: "action must be approve, reject or unpublish" }, { status: 400 });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ banner: result.data });
}
