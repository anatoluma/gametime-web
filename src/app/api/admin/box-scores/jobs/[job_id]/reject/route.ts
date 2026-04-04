import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params;

  let body: { reason?: unknown };
  try {
    body = (await request.json()) as { reason?: unknown };
  } catch {
    body = {};
  }

  const reason =
    typeof body?.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim()
      : null;

  const { data: job, error: fetchError } = await supabaseAdmin
    .from("processing_jobs")
    .select("id")
    .eq("id", job_id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("processing_jobs")
    .update({
      status: "rejected",
      error_message: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ job_id, status: "rejected" });
}
