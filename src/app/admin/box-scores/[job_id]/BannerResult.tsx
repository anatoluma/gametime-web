"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin-fetch";

type Result = { status: string; message: string; outdated?: boolean; at?: string } | null;

const LABEL: Record<string, { text: string; tone: string }> = {
  created: { text: "Banner draft created", tone: "text-emerald-600 dark:text-emerald-400" },
  regenerated: { text: "Banner draft updated", tone: "text-emerald-600 dark:text-emerald-400" },
  already_exists: { text: "Banner already exists", tone: "text-[var(--foreground)]" },
  approved_exists: { text: "Published banner left unchanged", tone: "text-amber-600 dark:text-amber-400" },
  skipped: { text: "Banner not generated", tone: "text-amber-600 dark:text-amber-400" },
  failed: { text: "Banner generation failed", tone: "text-red-600 dark:text-red-400" },
};

export default function BannerResult({ jobId, result }: { jobId: string; result: Result }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/box-scores/jobs/${jobId}/banner`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "Retry failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  };

  const label = result ? (LABEL[result.status] ?? { text: result.status, tone: "" }) : null;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-5 mb-6">
      <h2 className="text-lg font-semibold mb-2">Homepage banner</h2>
      {result && label ? (
        <>
          <p className={`text-sm font-medium ${label.tone}`}>{label.text}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{result.message}</p>
        </>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">No banner generation has been recorded for this job.</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <Link href="/admin/banners" className="underline hover:text-[var(--accent)]">
          Open banners
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={retry}
          className="rounded border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--surface-muted)] disabled:opacity-50"
        >
          {busy ? "Generating…" : result?.status === "failed" || !result ? "Retry generation" : "Re-check banner"}
        </button>
      </div>
    </section>
  );
}
