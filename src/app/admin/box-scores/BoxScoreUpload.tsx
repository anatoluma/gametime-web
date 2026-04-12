"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function BoxScoreUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File) {
    setError(null);
    setFile(f);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("season_id", "1");
      form.append("competition_id", "1");

      const res = await fetch("/api/admin/box-scores/upload", {
        method: "POST",
        body: form,
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }

      router.push(`/admin/box-scores/${json.job_id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-8">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-colors select-none",
          dragging
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface-muted)]",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={onFileChange}
        />
        <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        {file ? (
          <p className="text-sm font-medium text-[var(--foreground)]">{file.name}</p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Drop a FIBA box score image or <span className="text-[var(--accent)] underline">browse</span>
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)]">JPEG · PNG · WebP · max 10 MB</p>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={!file || uploading}
        className="mt-3 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        {uploading ? "Uploading & processing… (this takes ~20 s)" : "Upload & process"}
      </button>
    </form>
  );
}
