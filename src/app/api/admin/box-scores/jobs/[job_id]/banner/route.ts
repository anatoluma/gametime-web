import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { generateBannerAfterCommit } from "@/lib/banner/auto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/admin/box-scores/jobs/:job_id/banner — retry banner generation for a committed job.
// Same logic as the automatic step: creates or refreshes a draft, never touches a published banner.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { job_id } = await params;

  const { data: job, error } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, status")
    .eq("id", job_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "committed") {
    return NextResponse.json({ error: "Only committed jobs can generate a banner" }, { status: 409 });
  }

  // commitJob stamps the job on game_details; fall back to the previously recorded result.
  const { data: details } = await supabaseAdmin
    .from("game_details")
    .select("game_id")
    .eq("source_job_id", job_id)
    .maybeSingle();
  let gameId: string | null = details?.game_id ?? null;
  if (!gameId) {
    const { data: recorded } = await supabaseAdmin
      .from("processing_jobs")
      .select("banner_result")
      .eq("id", job_id)
      .maybeSingle();
    gameId = (recorded?.banner_result as { game_id?: string | null } | null)?.game_id ?? null;
  }
  if (!gameId) return NextResponse.json({ error: "Could not determine this job's game" }, { status: 404 });

  const banner = await generateBannerAfterCommit(job_id, gameId);
  return NextResponse.json({ job_id, banner });
}
