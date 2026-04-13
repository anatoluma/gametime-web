"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { NameResolutionResult } from "@/lib/name-resolution";

type Override = {
  extracted_name: string;
  player_id: string;
};

type NewPlayerDraft = {
  first_name: string;
  last_name: string;
  jersey_number: string;
};

type Props = {
  jobId: string;
  resolutionResults: NameResolutionResult[];
  hasHardFailure: boolean;
  currentStatus: string;
  errorMessage?: string | null;
};

const TERMINAL_STATUSES = new Set(["approved", "committed", "rejected"]);
const RETRIABLE_STATUSES = new Set(["pending", "failed", "needs_review"]);

export default function JobActions({
  jobId,
  resolutionResults,
  hasHardFailure,
  currentStatus,
  errorMessage,
}: Props) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  // Keyed by extracted_name — holds form data for rows where reviewer chose "new player"
  const [newPlayers, setNewPlayers] = useState<Record<string, NewPlayerDraft>>({});
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isTerminal = TERMINAL_STATUSES.has(currentStatus);

  function setOverride(extractedName: string, playerId: string) {
    if (playerId === "new") {
      // Seed the draft with empty fields; keep override as "new" sentinel
      setNewPlayers((prev) => ({
        ...prev,
        [extractedName]: prev[extractedName] ?? { first_name: "", last_name: "", jersey_number: "" },
      }));
    } else {
      // Clear any pending new-player draft if reviewer switches away
      setNewPlayers((prev) => {
        const next = { ...prev };
        delete next[extractedName];
        return next;
      });
    }
    setOverrides((prev) => ({ ...prev, [extractedName]: playerId }));
  }

  function updateNewPlayer(extractedName: string, field: keyof NewPlayerDraft, value: string) {
    setNewPlayers((prev) => ({
      ...prev,
      [extractedName]: { ...prev[extractedName], [field]: value },
    }));
  }

  async function handleReprocess() {
    setLoading(true);
    setActionError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/box-scores/jobs/${jobId}/process`, {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Re-process failed");
      }
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    setLoading(true);
    setActionError(null);
    try {
      // Validate all "new" rows have at least a last name
      for (const [extractedName, draft] of Object.entries(newPlayers)) {
        if (overrides[extractedName] === "new" && !draft.last_name.trim()) {
          throw new Error(`Enter at least a last name for "${extractedName}"`);
        }
      }

      // Find which resolution result owns each new-player draft so we can get the team_code
      const resultByName = new Map(resolutionResults.map((r) => [r.extracted_name, r]));

      // Create new players first, collect their IDs to use as overrides
      const resolvedOverrides = { ...overrides };
      for (const [extractedName, draft] of Object.entries(newPlayers)) {
        if (overrides[extractedName] !== "new") continue;
        const r = resultByName.get(extractedName);
        const res = await fetch("/api/admin/players", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            first_name: draft.first_name.trim() || null,
            last_name: draft.last_name.trim(),
            team_code: r?.team_code ?? null,
            jersey_number: draft.jersey_number.trim() ? Number(draft.jersey_number) : null,
          }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(`Failed to create player "${extractedName}": ${body.error ?? "unknown error"}`);
        }
        const { player_id } = (await res.json()) as { player_id: string };
        resolvedOverrides[extractedName] = player_id;
      }

      const overrideList: Override[] = Object.entries(resolvedOverrides)
        .filter(([, player_id]) => player_id && player_id !== "new")
        .map(([extracted_name, player_id]) => ({ extracted_name, player_id }));

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
                {(() => {
                  // Build a set of resolved_player_ids that appear more than once
                  // so we can warn the reviewer about collisions
                  const playerIdCount = new Map<string, number>();
                  for (const r of resolutionResults) {
                    const id = overrides[r.extracted_name] ?? r.resolved_player_id;
                    if (id) playerIdCount.set(id, (playerIdCount.get(id) ?? 0) + 1);
                  }

                  return resolutionResults.map((r) => {
                    const effectivePlayerId = overrides[r.extracted_name] ?? r.resolved_player_id ?? "";
                    const isDuplicate = !!effectivePlayerId && (playerIdCount.get(effectivePlayerId) ?? 0) > 1;

                    const isUnresolved = r.resolved_player_id === null;
                    const isAmbiguous = r.method === "manual" || r.method === "number_hint";
                    // Also force review for any row sharing its resolved player with another row
                    const needsInput =
                      !isTerminal &&
                      (isUnresolved || isAmbiguous || r.method === "unresolved" || isDuplicate);

                    let rowBg = "";
                    if (isDuplicate) {
                      rowBg = "bg-orange-50 dark:bg-orange-950/20";
                    } else if (isUnresolved) {
                      rowBg = "bg-red-50 dark:bg-red-950/20";
                    } else if (isAmbiguous) {
                      rowBg = "bg-amber-50 dark:bg-amber-950/20";
                    }

                    const key = `${r.team_code}-${r.number}-${r.extracted_name}`;

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
                            <div className="flex flex-col gap-1">
                              <select
                                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-w-[220px]"
                                value={effectivePlayerId}
                                onChange={(e) => setOverride(r.extracted_name, e.target.value)}
                              >
                                <option value="">— pick player —</option>
                                {(r.candidates ?? []).map((c) => (
                                  <option key={c.player_id} value={c.player_id}>
                                    {c.player_id === r.resolved_player_id ? "✓ " : ""}
                                    {c.name}
                                    {c.jersey_number != null ? ` #${c.jersey_number}` : ""}
                                    {` (${Math.round(c.confidence * 100)}%)`}
                                  </option>
                                ))}
                                <option value="new">➕ New player</option>
                              </select>
                              {effectivePlayerId === "new" && (
                                <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                                  <input
                                    type="text"
                                    placeholder="First name"
                                    value={newPlayers[r.extracted_name]?.first_name ?? ""}
                                    onChange={(e) => updateNewPlayer(r.extracted_name, "first_name", e.target.value)}
                                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                  />
                                  <input
                                    type="text"
                                    placeholder="Last name *"
                                    value={newPlayers[r.extracted_name]?.last_name ?? ""}
                                    onChange={(e) => updateNewPlayer(r.extracted_name, "last_name", e.target.value)}
                                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                  />
                                  <input
                                    type="number"
                                    placeholder="#"
                                    value={newPlayers[r.extracted_name]?.jersey_number ?? ""}
                                    onChange={(e) => updateNewPlayer(r.extracted_name, "jersey_number", e.target.value)}
                                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs w-14 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                  />
                                  <span className="text-xs text-[var(--text-muted)]">team: {r.team_code ?? "?"}</span>
                                </div>
                              )}
                              {isDuplicate && (
                                <span className="text-xs text-orange-600 dark:text-orange-400">
                                  ⚠ Same player as another row — confirm or correct
                                </span>
                              )}
                            </div>
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
                              isDuplicate
                                ? "text-orange-600 dark:text-orange-400"
                                : r.method === "unresolved"
                                ? "text-red-600 dark:text-red-400"
                                : isAmbiguous
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-[var(--text-muted)]"
                            }`}
                          >
                            {isDuplicate ? "collision" : r.method}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })()}
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
            {/* Retry pipeline for stuck/failed jobs */}
            {RETRIABLE_STATUSES.has(currentStatus) && (
              <button
                type="button"
                disabled={loading}
                onClick={handleReprocess}
                className="rounded-lg px-5 py-2 text-sm font-semibold border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Processing… (~20 s)" : "↺ Re-process"}
              </button>
            )}

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
        <p className={`text-sm text-center py-2 font-medium ${
          currentStatus === "approved" ? "text-green-600 dark:text-green-400" :
          currentStatus === "committed" ? "text-emerald-600 dark:text-emerald-400" :
          "text-[var(--text-muted)]"
        }`}>
          {currentStatus === "approved" && "✓ Job approved — ready to commit."}
          {currentStatus === "committed" && "✓ Job committed to the database."}
          {currentStatus === "rejected" && `Job rejected${errorMessage ? `: ${errorMessage}` : "."}`}
          {currentStatus === "failed" && "Job failed during processing."}
        </p>
      )}
    </div>
  );
}
