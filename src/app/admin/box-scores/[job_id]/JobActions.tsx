"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NameResolutionResult } from "@/lib/name-resolution";

type Override = {
  extracted_name: string;
  player_id: string;
};

type Props = {
  jobId: string;
  resolutionResults: NameResolutionResult[];
  hasHardFailure: boolean;
  currentStatus: string;
};

const TERMINAL_STATUSES = new Set(["committed", "rejected", "failed"]);

export default function JobActions({
  jobId,
  resolutionResults,
  hasHardFailure,
  currentStatus,
}: Props) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isTerminal = TERMINAL_STATUSES.has(currentStatus);

  function setOverride(extractedName: string, playerId: string) {
    setOverrides((prev) => ({ ...prev, [extractedName]: playerId }));
  }

  async function handleApprove() {
    setLoading(true);
    setActionError(null);
    try {
      const overrideList: Override[] = Object.entries(overrides).map(
        ([extracted_name, player_id]) => ({ extracted_name, player_id })
      );
      const res = await fetch(`/api/admin/box-scores/jobs/${jobId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overrides: overrideList }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Approve failed");
      }
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/box-scores/jobs/${jobId}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Reject failed");
      }
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (resolutionResults.length === 0 && isTerminal) return null;

  return (
    <div className="space-y-6">
      {/* Name resolution table */}
      {resolutionResults.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-5">
          <h2 className="text-lg font-semibold mb-4">Name Resolution</h2>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[var(--border)]">
                  <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Team</th>
                  <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">#</th>
                  <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Extracted</th>
                  <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Resolved as</th>
                  <th className="pb-2 pr-4 font-medium text-[var(--text-muted)]">Conf.</th>
                  <th className="pb-2 font-medium text-[var(--text-muted)]">Method</th>
                </tr>
              </thead>
              <tbody>
                {resolutionResults.map((r) => {
                  const isUnresolved = r.resolved_player_id === null;
                  const isAmbiguous = r.method === "manual" || r.method === "number_hint";
                  const needsInput =
                    !isTerminal &&
                    (isUnresolved || isAmbiguous || r.method === "unresolved");

                  let rowBg = "";
                  if (isUnresolved) {
                    rowBg = "bg-red-50 dark:bg-red-950/20";
                  } else if (isAmbiguous) {
                    rowBg = "bg-amber-50 dark:bg-amber-950/20";
                  }

                  const key = `${r.team_code}-${r.number}-${r.extracted_name}`;
                  const effectivePlayerId = overrides[r.extracted_name] ?? r.resolved_player_id ?? "";

                  return (
                    <tr
                      key={key}
                      className={`border-b border-[var(--border)] last:border-0 ${rowBg}`}
                    >
                      <td className="py-2.5 pr-4 font-mono text-xs">{r.team_code ?? "—"}</td>
                      <td className="py-2.5 pr-4 tabular-nums">{r.number ?? "—"}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{r.extracted_name}</td>
                      <td className="py-2.5 pr-4">
                        {needsInput ? (
                          <select
                            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-w-[180px]"
                            value={effectivePlayerId}
                            onChange={(e) => setOverride(r.extracted_name, e.target.value)}
                          >
                            <option value="">— pick player —</option>
                            {r.resolved_player_id && (
                              <option value={r.resolved_player_id}>
                                ✓ {r.resolved_name ?? r.resolved_player_id}
                              </option>
                            )}
                            {(r.candidates ?? [])
                              .filter((c) => c.player_id !== r.resolved_player_id)
                              .map((c) => (
                                <option key={c.player_id} value={c.player_id}>
                                  {c.name}
                                  {c.jersey_number != null ? ` #${c.jersey_number}` : ""}
                                  {` (${Math.round(c.confidence * 100)}%)`}
                                </option>
                              ))}
                            <option value="new">➕ New player</option>
                          </select>
                        ) : (
                          <span className="text-sm">{r.resolved_name ?? r.resolved_player_id ?? "—"}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-xs">
                        {r.confidence > 0 ? `${Math.round(r.confidence * 100)}%` : "—"}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`text-xs font-medium ${
                            r.method === "unresolved"
                              ? "text-red-600 dark:text-red-400"
                              : isAmbiguous
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-[var(--text-muted)]"
                          }`}
                        >
                          {r.method}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Action bar */}
      {!isTerminal && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-5 sticky bottom-4 shadow-sm">
          {actionError && (
            <p className="mb-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
              {actionError}
            </p>
          )}
          <div className="flex flex-wrap items-start gap-4">
            {/* Approve */}
            <button
              type="button"
              disabled={hasHardFailure || loading}
              onClick={handleApprove}
              className="rounded-lg px-5 py-2 text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving…" : "Approve"}
            </button>

            {hasHardFailure && (
              <span className="self-center text-xs text-red-600 dark:text-red-400">
                Hard validation failure — cannot approve
              </span>
            )}

            {/* Reject */}
            {!showReject ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowReject(true)}
                className="rounded-lg px-5 py-2 text-sm font-semibold border border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 transition-colors"
              >
                Reject
              </button>
            ) : (
              <div className="flex items-start gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleReject(); }}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 w-56"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleReject}
                  className="rounded-lg px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  {loading ? "Saving…" : "Confirm Reject"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowReject(false)}
                  className="rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Committed/rejected notice */}
      {isTerminal && (
        <p className="text-sm text-[var(--text-muted)] text-center py-2">
          This job is <strong>{currentStatus}</strong> and can no longer be modified.
        </p>
      )}
    </div>
  );
}
