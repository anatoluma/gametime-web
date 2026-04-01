import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params;

  const { data: job, error } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, status, raw_file_path, extraction_json, validation_json, resolution_json, error_message, created_at, updated_at")
    .eq("id", job_id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    job_id: job.id,
    status: job.status,
    file_url: job.raw_file_path,
    extraction: job.extraction_json ?? null,
    validation: job.validation_json ?? null,
    name_resolution: job.resolution_json ?? null,
    error_message: job.error_message ?? null,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
}
