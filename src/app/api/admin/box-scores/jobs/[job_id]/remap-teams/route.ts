import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolvePlayerNames } from "@/lib/name-resolution";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ExtractionPlayer = {
  team_code?: string | null;
  [key: string]: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params;

  let body: { home_code?: string; away_code?: string };
  try {
    body = (await request.json()) as { home_code?: string; away_code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { home_code, away_code } = body;
  if (!home_code || !away_code) {
    return NextResponse.json({ error: "home_code and away_code are required" }, { status: 400 });
  }

  const { data: job, error: fetchError } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, status, extraction_json")
    .eq("id", job_id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const extraction = (job.extraction_json ?? {}) as Record<string, unknown>;
  const oldHomeCode = (extraction.home_team as Record<string, unknown> | null)?.code as string | null;
  const oldAwayCode = (extraction.away_team as Record<string, unknown> | null)?.code as string | null;

  // Update home_team and away_team codes
  const updatedExtraction: Record<string, unknown> = {
    ...extraction,
    home_team: { ...(extraction.home_team as object), code: home_code.trim().toUpperCase() },
    away_team: { ...(extraction.away_team as object), code: away_code.trim().toUpperCase() },
  };

  // Remap every player whose team_code matched the old extracted code
  if (Array.isArray(updatedExtraction.players)) {
    updatedExtraction.players = (updatedExtraction.players as ExtractionPlayer[]).map((p) => {
      if (p.team_code === oldHomeCode) return { ...p, team_code: home_code.trim().toUpperCase() };
      if (p.team_code === oldAwayCode) return { ...p, team_code: away_code.trim().toUpperCase() };
      return p;
    });
  }

  // Also remap team_totals if present
  if (Array.isArray(updatedExtraction.team_totals)) {
    updatedExtraction.team_totals = (updatedExtraction.team_totals as ExtractionPlayer[]).map((t) => {
      if (t.team_code === oldHomeCode) return { ...t, team_code: home_code.trim().toUpperCase() };
      if (t.team_code === oldAwayCode) return { ...t, team_code: away_code.trim().toUpperCase() };
      return t;
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from("processing_jobs")
    .update({
      extraction_json: updatedExtraction,
      status: "resolving",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Re-run name resolution with the corrected team codes
  try {
    await resolvePlayerNames(job_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Name resolution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
