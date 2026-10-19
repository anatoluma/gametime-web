import { NextResponse } from "next/server";
import { commitJob } from "@/lib/commit";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { job_id } = await params;

  try {
    const result = await commitJob(job_id);
    return NextResponse.json({ job_id, status: "committed", game_id: result.game_id, banner: result.banner });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Commit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
