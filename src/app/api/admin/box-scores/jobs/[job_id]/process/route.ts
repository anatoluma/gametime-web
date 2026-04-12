import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const secret = request.headers.get("x-internal-secret");
  if (secret !== (process.env.INTERNAL_SECRET ?? "dev")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { job_id } = await params;

  await runPipeline(job_id);

  return NextResponse.json({ job_id, accepted: true });
}
