"use client";

import { useEffect, useState } from "react";
import ManagerPage from "@/app/manager/page";

export default function ManagePage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = window.location.hash.slice(1);
    if (!token) {
      queueMicrotask(() => setReady(true));
      return;
    }

    fetch("/api/manager/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "This manager link is invalid or expired.");
        return;
      }
      window.history.replaceState(null, "", "/manage");
      setReady(true);
    }).catch(() => setError("Unable to open this manager link."));
  }, []);

  if (error) {
    return <main className="mx-auto max-w-3xl px-4 py-12 text-[var(--foreground)]"><p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p></main>;
  }
  return ready ? <ManagerPage /> : <main className="mx-auto max-w-3xl px-4 py-12 text-[var(--foreground)]"><p className="text-sm text-[var(--text-muted)]">Opening team roster...</p></main>;
}