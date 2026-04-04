import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Override = {
  extracted_name: string;
  player_id: string;
};

type ValidationCheck = {
  severity: string;
  passed: boolean;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params;

  let body: { overrides?: unknown };
  try {
    body = (await request.json()) as { overrides?: unknown };
  } catch {
    body = {};
  }

  const overrides: Override[] = Array.isArray(body?.overrides)
    ? (body.overrides as Override[]).filter(
        (o) => typeof o?.extracted_name === "string" && typeof o?.player_id === "string"
      )
    : [];

  const { data: job, error: fetchError } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, status, validation_json, resolution_json")
    .eq("id", job_id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Block approve if any hard validation check failed
  const validationChecks = (job.validation_json ?? []) as ValidationCheck[];
  const hasHardFailure = validationChecks.some((c) => c.severity === "hard" && !c.passed);
  if (hasHardFailure) {
    return NextResponse.json(
      { error: "Cannot approve: hard validation failure present" },
      { status: 422 }
    );
  }

  // Apply name overrides to resolution_json
  let resolutionJson = (job.resolution_json ?? []) as Record<string, unknown>[];
  if (overrides.length > 0) {
    const overrideMap = new Map(overrides.map((o) => [o.extracted_name, o.player_id]));
    resolutionJson = resolutionJson.map((r) => {
      const override = overrideMap.get(r.extracted_name as string);
      if (!override) return r;
      return {
        ...r,
        resolved_player_id: override === "new" ? null : override,
        method: "manual",
        confirmed: true,
        confidence: 1.0,
      };
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from("processing_jobs")
    .update({
      status: "approved",
      resolution_json: resolutionJson,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ job_id, status: "approved" });
}
