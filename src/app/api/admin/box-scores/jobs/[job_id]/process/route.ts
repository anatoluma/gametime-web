import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { job_id } = await params;
  await runPipeline(job_id);
  return NextResponse.json({ job_id, accepted: true });
}
