import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { commitJob } from "@/lib/commit";
import { requireAdmin } from "@/lib/admin-auth";
import { evaluateCommitReadiness } from "@/lib/commit-readiness";
import { formatIntegrityErrors } from "@/lib/commit-integrity";
import type { ResolutionItemLike } from "@/lib/roster-utils";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Override = {
  extracted_name: string;
  team_code?: string | null;
  number?: unknown;
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
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { job_id } = await params;

  let body: { overrides?: unknown; override_validation?: boolean };
  try {
    body = (await request.json()) as { overrides?: unknown; override_validation?: boolean };
  } catch {
    body = {};
  }

  const overrides: Override[] = Array.isArray(body?.overrides)
    ? (body.overrides as Override[]).filter(
        (o) => typeof o?.extracted_name === "string" && typeof o?.player_id === "string"
      )
    : [];
  const overrideValidation = body?.override_validation === true;

  const { data: job, error: fetchError } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, status, validation_json, resolution_json, extraction_json")
    .eq("id", job_id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Block approve if any hard validation check failed (unless override is set)
  const validationChecks = (job.validation_json ?? []) as ValidationCheck[];
  const hasHardFailure = validationChecks.some((c) => c.severity === "hard" && !c.passed);
  if (hasHardFailure && !overrideValidation) {
    return NextResponse.json(
      { error: "Cannot approve: hard validation failure present" },
      { status: 422 }
    );
  }

  // Apply name overrides to resolution_json
  let resolutionJson = (job.resolution_json ?? []) as Record<string, unknown>[];
  if (overrides.length > 0) {
    const overrideFor = (r: Record<string, unknown>) => {
      const sameRow = (o: Override) =>
        o.extracted_name === r.extracted_name &&
        (o.team_code === undefined || (o.team_code ?? null) === (r.team_code ?? null)) &&
        (o.number === undefined || (o.number ?? null) === (r.number ?? null));
      return overrides.find(sameRow)?.player_id;
    };
    const overrideIds = [...new Set(overrides.map((o) => o.player_id).filter((id) => id !== "new"))];
    const nameById = new Map<string, string>();
    if (overrideIds.length > 0) {
      const { data: named } = await supabaseAdmin
        .from("players")
        .select("player_id, first_name, last_name")
        .in("player_id", overrideIds);
      for (const p of named ?? []) {
        nameById.set(p.player_id as string, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim());
      }
    }
    resolutionJson = resolutionJson.map((r) => {
      const override = overrideFor(r);
      if (!override) return r;
      return {
        ...r,
        resolved_player_id: override === "new" ? null : override,
        resolved_name: override === "new" ? null : nameById.get(override) ?? r.resolved_name ?? null,
        method: "manual",
        confirmed: true,
        confidence: 1.0,
      };
    });
  }

  // Commit-readiness check (post-resolution). Unlike extraction validation this cannot be overridden:
  // storing stats that do not reconcile would silently corrupt player and team totals.
  try {
    const readiness = await evaluateCommitReadiness(
      { id: job.id as string, extraction_json: job.extraction_json, resolution_json: resolutionJson },
      { resolutions: resolutionJson as ResolutionItemLike[] }
    );
    if (!readiness.result.ok) {
      return NextResponse.json(
        {
          error: formatIntegrityErrors(readiness.result.errors),
          integrity_errors: readiness.result.errors,
        },
        { status: 422 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Commit-readiness check failed";
    return NextResponse.json({ error: message }, { status: 500 });
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

  // Commit the approved job — writes to games and player_game_stats, marks status committed
  let game_id: string;
  let banner: unknown;
  try {
    const result = await commitJob(job_id);
    game_id = result.game_id;
    banner = result.banner;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Commit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ job_id, status: "committed", game_id, banner });
}
