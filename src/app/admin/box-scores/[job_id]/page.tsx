import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { notFound } from "next/navigation";
import JobActions from "./JobActions";
import ExtractionDebug from "./ExtractionDebug";
import TeamConfirmation from "./TeamConfirmation";
import { resolveTeamId } from "@/lib/team-codes";
import type { ValidationCheck } from "@/lib/validation";
import type { NameResolutionResult } from "@/lib/name-resolution";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  extracting: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  resolving: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  validating: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  needs_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  committed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

type ExtractionData = {
  home_team?: { code?: string; name?: string; score?: number } | null;
  away_team?: { code?: string; name?: string; score?: number } | null;
  date?: string | null;
  start_time?: string | null;
  competition?: string | null;
  game_number?: number | null;
  duration_minutes?: number | null;
  crew_chief?: string | null;
  umpires?: string[] | null;
};

export default async function BoxScoreJobDetailPage({
  params,
}: {
  params: Promise<{ job_id: string }>;
}) {
  const { job_id } = await params;

  const { data: job } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, status, raw_file_path, extraction_json, validation_json, resolution_json, error_message, created_at")
    .eq("id", job_id)
    .single();

  if (!job) notFound();

  const extraction = job.extraction_json as ExtractionData | null;
  const validationChecks = (job.validation_json ?? []) as ValidationCheck[];
  const resolutionResults = (job.resolution_json ?? []) as NameResolutionResult[];
  const home = extraction?.home_team;
  const away = extraction?.away_team;
  const hasHardFailure = validationChecks.some((c) => c.severity === "hard" && !c.passed);
  const badgeClass = STATUS_BADGE[job.status as string] ?? "bg-gray-100 text-gray-600";

  // Detect unresolvable team codes so TeamConfirmation knows when to show
  const homeCodeUnresolvable = !!home?.code && !resolveTeamId(home.code);
  const awayCodeUnresolvable = !!away?.code && !resolveTeamId(away.code);
  const needsTeamConfirmation = homeCodeUnresolvable || awayCodeUnresolvable;

  // Load team list for the confirmation dropdowns (only when needed)
  let teamOptions: { team_id: string; team_name: string | null }[] = [];
  if (needsTeamConfirmation) {
    const { data: teamsData } = await supabaseAdmin
      .from("teams")
      .select("team_id, team_name")
      .order("team_id");
    teamOptions = (teamsData ?? []) as { team_id: string; team_name: string | null }[];
  }

  // Generate a short-lived signed URL for the raw box score image
  let imageUrl: string | null = null;
  if (job.raw_file_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from(process.env.BOX_SCORES_STORAGE_BUCKET ?? "uploads")
      .createSignedUrl(job.raw_file_path as string, 3600);
    imageUrl = signed?.signedUrl ?? null;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 text-[var(--foreground)]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8 text-sm text-[var(--text-muted)]">
        <Link href="/admin" className="hover:text-[var(--accent)] underline">Admin</Link>
        <span>/</span>
        <Link href="/admin/box-scores" className="hover:text-[var(--accent)] underline">Box Scores</Link>
        <span>/</span>
        <span className="font-mono">{(job_id as string).slice(0, 8)}…</span>
      </div>

      {/* Game meta header */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl font-semibold">
            {home?.code ?? "?"} vs {away?.code ?? "?"}
            {home?.score != null && away?.score != null && (
              <span className="ml-3 text-xl font-normal text-[var(--text-muted)]">
                {home.score} – {away.score}
              </span>
            )}
          </h1>
          <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
            {job.status}
          </span>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 text-sm">
          {extraction?.date && (
            <>
              <dt className="text-[var(--text-muted)]">Date</dt>
              <dd className="font-medium">{extraction.date}</dd>
            </>
          )}
          {extraction?.competition && (
            <>
              <dt className="text-[var(--text-muted)]">Competition</dt>
              <dd>{extraction.competition}</dd>
            </>
          )}
          {extraction?.game_number != null && (
            <>
              <dt className="text-[var(--text-muted)]">Game #</dt>
              <dd>{extraction.game_number}</dd>
            </>
          )}
          {extraction?.start_time && (
            <>
              <dt className="text-[var(--text-muted)]">Tip-off</dt>
              <dd>{extraction.start_time}</dd>
            </>
          )}
          {extraction?.duration_minutes != null && (
            <>
              <dt className="text-[var(--text-muted)]">Duration</dt>
              <dd>{extraction.duration_minutes} min</dd>
            </>
          )}
          {extraction?.crew_chief && (
            <>
              <dt className="text-[var(--text-muted)]">Crew Chief</dt>
              <dd>{extraction.crew_chief}</dd>
            </>
          )}
          {extraction?.umpires && extraction.umpires.length > 0 && (
            <>
              <dt className="text-[var(--text-muted)]">Umpires</dt>
              <dd>{extraction.umpires.join(", ")}</dd>
            </>
          )}
        </dl>

        {job.error_message && (
          <p className="mt-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
            {job.error_message as string}
          </p>
        )}
      </section>

      {/* Team code confirmation — shown when extracted codes can't be resolved */}
      {needsTeamConfirmation && (
        <TeamConfirmation
          jobId={job_id as string}
          extractedHomeCode={home?.code ?? null}
          extractedAwayCode={away?.code ?? null}
          teams={teamOptions}
          isTerminal={["approved", "committed", "rejected"].includes(job.status as string)}
        />
      )}

      {/* Image + extraction debug (collapsible) */}
      <ExtractionDebug
        extractionJson={job.extraction_json as Record<string, unknown> | null}
        imageUrl={imageUrl}
        resolutionResults={resolutionResults}
      />

      {/* Validation checks */}
      {validationChecks.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-5 mb-6">
          <h2 className="text-lg font-semibold mb-4">Validation</h2>
          <ul className="space-y-2">
            {validationChecks.map((check) => (
              <li key={check.rule_id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 shrink-0 w-4 text-center">
                  {check.passed ? (
                    <span className="text-green-600 dark:text-green-400">✓</span>
                  ) : check.severity === "hard" ? (
                    <span className="text-red-600 dark:text-red-400">✗</span>
                  ) : (
                    <span className="text-amber-500 dark:text-amber-400">⚠</span>
                  )}
                </span>
                <span className={check.passed ? "text-[var(--foreground)]" : check.severity === "hard" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}>
                  <span className="font-mono text-xs text-[var(--text-muted)] mr-2">{check.rule_id}</span>
                  {check.detail}
                </span>
              </li>
            ))}
          </ul>
          {hasHardFailure && (
            <div className="mt-4 rounded bg-red-50 border border-red-200 px-4 py-3 dark:bg-red-950/30 dark:border-red-800">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
                ✗ Hard failure — cannot approve until re-processed
              </p>
              <ul className="space-y-1">
                {validationChecks.filter((c) => c.severity === "hard" && !c.passed).map((c) => (
                  <li key={c.rule_id} className="text-xs text-red-700 dark:text-red-400">
                    <span className="font-mono mr-2">{c.rule_id}</span>{c.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Interactive: name resolution + action buttons (client component) */}
      <JobActions
        jobId={job_id as string}
        resolutionResults={resolutionResults}
        hasHardFailure={hasHardFailure}
        currentStatus={job.status as string}
        errorMessage={job.error_message as string | null}
      />
    </main>
  );
}
