import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ExtractionMeta = {
  home_team?: { code?: string; score?: number } | null;
  away_team?: { code?: string; score?: number } | null;
  date?: string | null;
};

type ProcessingJob = {
  id: string;
  status: string;
  extraction_json: ExtractionMeta | null;
  created_at: string;
};

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

export default async function BoxScoresAdminPage() {
  const { data: jobs } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, status, extraction_json, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (jobs ?? []) as ProcessingJob[];

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 text-[var(--foreground)]">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Box Score Jobs</h1>
        <Link
          href="/admin"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)] underline"
        >
          ← Admin
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-[var(--text-muted)]">No jobs yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-[var(--surface-muted)] border-b border-[var(--border)]">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Home</th>
                <th className="px-4 py-3 font-medium">Away</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => {
                const home = job.extraction_json?.home_team;
                const away = job.extraction_json?.away_team;
                const gameDate = job.extraction_json?.date ?? job.created_at.slice(0, 10);
                const badgeClass = STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-600";
                return (
                  <tr
                    key={job.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)] transition-colors"
                  >
                    <td className="px-4 py-3 tabular-nums">{gameDate}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{home?.code ?? "—"}</td>
                    <td className="px-4 py-3">{away?.code ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {home?.score != null && away?.score != null
                        ? `${home.score} – ${away.score}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/box-scores/${job.id}`}
                        className="text-[var(--accent)] hover:underline text-xs font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
