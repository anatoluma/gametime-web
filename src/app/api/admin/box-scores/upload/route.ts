import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runPipeline } from "@/lib/pipeline";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const seasonIdRaw = formData.get("season_id");
  const competitionIdRaw = formData.get("competition_id");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported file type. Accepted: image/jpeg, image/png, image/webp" },
      { status: 415 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
  }

  const seasonId = Number(seasonIdRaw);
  const competitionId = Number(competitionIdRaw);

  if (!Number.isInteger(seasonId) || seasonId <= 0) {
    return NextResponse.json({ error: "season_id must be a positive integer" }, { status: 400 });
  }
  if (!Number.isInteger(competitionId) || competitionId <= 0) {
    return NextResponse.json({ error: "competition_id must be a positive integer" }, { status: 400 });
  }

  const jobId = crypto.randomUUID();
  const storagePath = `box-scores/raw/${jobId}.${ext}`;

  const fileBuffer = await file.arrayBuffer();

  const { error: storageError } = await supabaseAdmin.storage
    .from("uploads")
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (storageError) {
    return NextResponse.json({ error: `Storage upload failed: ${storageError.message}` }, { status: 500 });
  }

  const { data: job, error: dbError } = await supabaseAdmin
    .from("processing_jobs")
    .insert({
      id: jobId,
      status: "pending",
      season_id: seasonId,
      competition_id: competitionId,
      raw_file_path: storagePath,
    })
    .select("id, status, created_at")
    .single();

  if (dbError) {
    // Best-effort cleanup of orphaned storage object
    await supabaseAdmin.storage.from("uploads").remove([storagePath]);
    return NextResponse.json({ error: `Database insert failed: ${dbError.message}` }, { status: 500 });
  }
  // Run the pipeline synchronously so it completes before the response is sent.
  // This takes ~15–30 s (Claude Vision call) but is reliable on serverless — no
  // fire-and-forget background tasks that get killed when the request closes.
  await runPipeline(jobId);

  const { data: updatedJob } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, status, created_at")
    .eq("id", jobId)
    .single();

  return NextResponse.json(
    { job_id: jobId, status: updatedJob?.status ?? "pending", created_at: updatedJob?.created_at ?? job.created_at },
    { status: 202 }
  );
}
