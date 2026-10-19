"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-fetch";

type Team = { team_id: string; team_name: string | null };

type Photo = {
  photo_id: string;
  team_id: string;
  original_name: string | null;
  size_bytes: number;
  is_active: boolean;
  created_at: string;
  url: string;
};

type Notice = { text: string; kind: "success" | "error" } | null;

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

export default function AdminMediaPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filter, setFilter] = useState("");
  const [uploadTeam, setUploadTeam] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const readResponse = useCallback(
    async (res: Response) => {
      if (res.status === 401) {
        router.replace("/login");
        return { ok: false, json: null };
      }
      return { ok: res.ok, json: await res.json().catch(() => null) };
    },
    [router]
  );

  const load = useCallback(async () => {
    const [teamsRes, photosRes] = await Promise.all([
      adminFetch("/api/admin/teams"),
      adminFetch("/api/admin/team-photos"),
    ]);
    const teamsData = await readResponse(teamsRes);
    const photosData = await readResponse(photosRes);

    if (!teamsData.ok || !photosData.ok) {
      setNotice({
        text: teamsData.json?.error ?? photosData.json?.error ?? "Failed to load media library",
        kind: "error",
      });
    } else {
      setTeams(teamsData.json?.teams ?? []);
      setPhotos(photosData.json?.photos ?? []);
    }
    setLoading(false);
  }, [readResponse]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const teamName = useMemo(() => new Map(teams.map((t) => [t.team_id, t.team_name ?? t.team_id])), [teams]);
  const visible = filter ? photos.filter((p) => p.team_id === filter) : photos;

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!uploadTeam) {
      setNotice({ text: "Choose a team before uploading", kind: "error" });
      return;
    }

    setUploading(true);
    setNotice(null);
    let done = 0;
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name}: exceeds 10 MB`);
        continue;
      }
      const body = new FormData();
      body.append("team_id", uploadTeam);
      body.append("file", file);

      const { ok, json } = await readResponse(await adminFetch("/api/admin/team-photos", { method: "POST", body }));
      if (ok && json?.photo) {
        done += 1;
        setPhotos((prev) => [json.photo as Photo, ...prev]);
      } else {
        errors.push(`${file.name}: ${json?.error ?? "upload failed"}`);
      }
    }

    setUploading(false);
    setNotice({
      text: [done ? `${done} photo(s) uploaded.` : "", ...errors].filter(Boolean).join(" "),
      kind: errors.length ? "error" : "success",
    });
  };

  const toggleActive = async (photo: Photo) => {
    setBusyId(photo.photo_id);
    const { ok, json } = await readResponse(
      await adminFetch("/api/admin/team-photos", {
        method: "PATCH",
        body: JSON.stringify({ photo_id: photo.photo_id, is_active: !photo.is_active }),
      })
    );
    if (ok && json?.photo) {
      setPhotos((prev) => prev.map((p) => (p.photo_id === photo.photo_id ? (json.photo as Photo) : p)));
    } else {
      setNotice({ text: json?.error ?? "Update failed", kind: "error" });
    }
    setBusyId(null);
  };

  const remove = async (photo: Photo) => {
    if (!window.confirm("Delete this photo permanently?")) return;
    setBusyId(photo.photo_id);
    const { ok, json } = await readResponse(
      await adminFetch(`/api/admin/team-photos?photo_id=${encodeURIComponent(photo.photo_id)}`, {
        method: "DELETE",
      })
    );
    if (ok) {
      setPhotos((prev) => prev.filter((p) => p.photo_id !== photo.photo_id));
    } else {
      setNotice({ text: json?.error ?? "Delete failed", kind: "error" });
    }
    setBusyId(null);
  };

  const field =
    "rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]";

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Team photos</h1>
        <Link href="/admin" className="text-sm text-[var(--text-muted)] hover:text-[var(--accent)] underline">
          Back to admin
        </Link>
      </div>

      {notice && (
        <p
          role="status"
          className={`mb-4 rounded border px-3 py-2 text-sm ${
            notice.kind === "error" ? "border-red-400 text-red-600" : "border-green-500 text-green-600"
          }`}
        >
          {notice.text}
        </p>
      )}

      <section className="mb-8 rounded-lg border border-[var(--border)] p-4">
        <h2 className="mb-3 text-lg font-medium">Upload</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select value={uploadTeam} onChange={(e) => setUploadTeam(e.target.value)} className={field}>
            <option value="">Select team…</option>
            {teams.map((t) => (
              <option key={t.team_id} value={t.team_id}>
                {t.team_name ?? t.team_id} ({t.team_id})
              </option>
            ))}
          </select>
          <input
            type="file"
            accept={ACCEPT}
            multiple
            disabled={uploading || !uploadTeam}
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = "";
            }}
            className="text-sm"
          />
          {uploading && <span className="text-sm text-[var(--text-muted)]">Uploading…</span>}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">JPEG, PNG or WebP, up to 10 MB each.</p>
      </section>

      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="team-filter" className="text-sm">
          Filter by team
        </label>
        <select id="team-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className={field}>
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.team_id} value={t.team_id}>
              {t.team_name ?? t.team_id}
            </option>
          ))}
        </select>
        <span className="text-sm text-[var(--text-muted)]">{visible.length} photo(s)</span>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No photos yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((photo) => (
            <li key={photo.photo_id} className="overflow-hidden rounded-lg border border-[var(--border)]">
              <a href={photo.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.original_name ?? "Team photo"}
                  loading="lazy"
                  className={`aspect-video w-full object-cover ${photo.is_active ? "" : "opacity-40 grayscale"}`}
                />
              </a>
              <div className="space-y-2 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{teamName.get(photo.team_id) ?? photo.team_id}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {photo.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {photo.original_name ?? "—"} · {(photo.size_bytes / 1024 / 1024).toFixed(1)} MB
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busyId === photo.photo_id}
                    onClick={() => toggleActive(photo)}
                    className="underline hover:text-[var(--accent)] disabled:opacity-50"
                  >
                    {photo.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === photo.photo_id}
                    onClick={() => remove(photo)}
                    className="text-red-600 underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
