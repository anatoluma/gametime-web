"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEAM_CODE_MAP } from "@/lib/team-codes";

type TeamOption = {
  team_id: string;
  name: string | null;
};

type Props = {
  jobId: string;
  extractedHomeCode: string | null;
  extractedAwayCode: string | null;
  teams: TeamOption[];
  isTerminal: boolean;
};

// Canonical team IDs (the values in TEAM_CODE_MAP)
const CANONICAL_IDS = new Set(Object.values(TEAM_CODE_MAP));

function resolveExtracted(code: string | null): string {
  if (!code) return "";
  const upper = code.trim().toUpperCase();
  // If it's already a canonical ID, use it; otherwise try the map
  if (CANONICAL_IDS.has(upper)) return upper;
  return TEAM_CODE_MAP[upper] ?? "";
}

export default function TeamConfirmation({
  jobId,
  extractedHomeCode,
  extractedAwayCode,
  teams,
  isTerminal,
}: Props) {
  const router = useRouter();
  const [homeCode, setHomeCode] = useState(() => resolveExtracted(extractedHomeCode));
  const [awayCode, setAwayCode] = useState(() => resolveExtracted(extractedAwayCode));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homeResolved = resolveExtracted(extractedHomeCode);
  const awayResolved = resolveExtracted(extractedAwayCode);

  // Only show warning if a code can't be resolved or was changed
  const homeUnknown = !homeResolved;
  const awayUnknown = !awayResolved;
  const homeMismatch = homeCode !== homeResolved;
  const awayMismatch = awayCode !== awayResolved;
  const needsAttention = homeUnknown || awayUnknown;

  if (!needsAttention && !isTerminal) return null;
  if (!needsAttention && isTerminal) return null;

  async function handleRemap() {
    if (!homeCode || !awayCode) {
      setError("Select both teams before confirming.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/box-scores/jobs/${jobId}/remap-teams`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ home_code: homeCode, away_code: awayCode }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to remap teams");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const sortedTeams = [...teams].sort((a, b) => a.team_id.localeCompare(b.team_id));

  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 px-6 py-5 mb-6">
      <h2 className="text-base font-semibold text-amber-800 dark:text-amber-300 mb-1">
        ⚠ Team code mismatch — confirm teams before name resolution
      </h2>
      <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
        One or more extracted team codes could not be matched to the database.
        Select the correct teams below, then click <strong>Re-resolve names</strong>.
      </p>

      <div className="flex flex-wrap gap-6 mb-4">
        {/* Home team */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Home team
            <span className="ml-1.5 font-mono text-[var(--text-muted)]">
              (extracted: {extractedHomeCode ?? "—"})
            </span>
            {homeUnknown && (
              <span className="ml-1.5 text-red-600 dark:text-red-400">✗ not recognised</span>
            )}
          </label>
          <select
            value={homeCode}
            onChange={(e) => setHomeCode(e.target.value)}
            disabled={loading || isTerminal}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
          >
            <option value="">— select team —</option>
            {sortedTeams.map((t) => (
              <option key={t.team_id} value={t.team_id}>
                {t.team_id}{t.name ? ` — ${t.name}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Away team */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Away team
            <span className="ml-1.5 font-mono text-[var(--text-muted)]">
              (extracted: {extractedAwayCode ?? "—"})
            </span>
            {awayUnknown && (
              <span className="ml-1.5 text-red-600 dark:text-red-400">✗ not recognised</span>
            )}
          </label>
          <select
            value={awayCode}
            onChange={(e) => setAwayCode(e.target.value)}
            disabled={loading || isTerminal}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
          >
            <option value="">— select team —</option>
            {sortedTeams.map((t) => (
              <option key={t.team_id} value={t.team_id}>
                {t.team_id}{t.name ? ` — ${t.name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!isTerminal && (
        <button
          type="button"
          disabled={loading || (!homeUnknown && !awayUnknown && !homeMismatch && !awayMismatch)}
          onClick={handleRemap}
          className="rounded-lg px-4 py-2 text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Re-resolving…" : "Re-resolve names"}
        </button>
      )}
    </section>
  );
}
