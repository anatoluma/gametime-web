"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-fetch";
import { supabase } from "@/lib/supabase/client";
type Team = { team_id: string; team_name: string | null };

type Photo = {
  photo_id: string;
  team_id: string;
  second_team_id: string | null;
  is_neutral: boolean;
  original_name: string | null;
  size_bytes: number;
  is_active: boolean;
  created_at: string;
  url: string;
};

type TeamsDraft = { team_id: string; second_team_id: string; is_neutral: boolean };

type Notice = { text: string; kind: "success" | "error" } | null;
type UploadResult = { name: string; ok: boolean; message?: string; warning?: string };

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;
const RECOMMENDED_RATIO = 8 / 3;
const RATIO_TOLERANCE = 0.15;

/** Nonblocking advice only; unreadable images are left for the server to judge. */
async function ratioWarning(file: File): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width / bitmap.height;
    const size = `${bitmap.width}×${bitmap.height}`;
    bitmap.close();
    if (Math.abs(ratio - RECOMMENDED_RATIO) / RECOMMENDED_RATIO > RATIO_TOLERANCE) {
      return `${size} is far from the recommended 8:3 ratio; banners will crop it.`;
    }
  } catch {
    // ignore
  }
  return undefined;
}

const field =
  "rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]";

/** Team 1 (required), Team 2 (optional) and, only with a Team 2, the neutral checkbox. */
function TeamFields({
  teams,
  value,
  disabled,
  onChange,
}: {
  teams: Team[];
  value: TeamsDraft;
  disabled?: boolean;
  onChange: (next: TeamsDraft) => void;
}) {
  const label = (t: Team) => `${t.team_name ?? t.team_id} (${t.team_id})`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        aria-label="Team 1"
        value={value.team_id}
        disabled={disabled}
        onChange={(e) => {
          const team_id = e.target.value;
          const clash = team_id === value.second_team_id;
          onChange({ team_id, second_team_id: clash ? "" : value.second_team_id, is_neutral: clash ? false : value.is_neutral });
        }}
        className={field}
      >
        <option value="">Team 1 (required)…</option>
        {teams.map((t) => (
          <option key={t.team_id} value={t.team_id}>
            {label(t)}
          </option>
        ))}
      </select>
      <select
        aria-label="Team 2"
        value={value.second_team_id}
        disabled={disabled}
        onChange={(e) => {
          const second_team_id = e.target.value;
          onChange({ ...value, second_team_id, is_neutral: second_team_id ? value.is_neutral : false });
        }}
        className={field}
      >
        <option value="">Team 2 (optional)…</option>
        {teams
          .filter((t) => t.team_id !== value.team_id)
          .map((t) => (
            <option key={t.team_id} value={t.team_id}>
              {label(t)}
            </option>
          ))}
      </select>
      {value.second_team_id && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.is_neutral}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, is_neutral: e.target.checked })}
          />
          Neutral photo
        </label>
      )}
    </div>
  );
}

const EMPTY_DRAFT: TeamsDraft = { team_id: "", second_team_id: "", is_neutral: false };

export default function AdminMediaPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filter, setFilter] = useState("");
  const [upload, setUpload] = useState<TeamsDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TeamsDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [results, setResults] = useState<UploadResult[]>([]);

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
  const visible = filter ? photos.filter((p) => p.team_id === filter || p.second_team_id === filter) : photos;

  const startUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!upload.team_id) {
      setNotice({ text: "Choose Team 1 before uploading", kind: "error" });
      return;
    }

    setUploading(true);
    setNotice(null);
    setResults([]);
    const collected: UploadResult[] = [];

    for (const file of Array.from(files)) {
      const warning = await ratioWarning(file);
      try {
        await uploadOne(file);
        collected.push({ name: file.name, ok: true, warning });
      } catch (err) {
        collected.push({ name: file.name, ok: false, message: err instanceof Error ? err.message : "Upload failed", warning });
      }
      setResults([...collected]);
    }

    setUploading(false);
    const failed = collected.filter((r) => !r.ok).length;
    setNotice({
      text: `${collected.length - failed} of ${collected.length} photo(s) uploaded${failed ? `, ${failed} failed` : ""}.`,
      kind: failed ? "error" : "success",
    });
  };

  // Bytes go straight to Supabase Storage via a server-authorized signed URL; the API only sees JSON.
  const uploadOne = async (file: File) => {
    if (file.size === 0) throw new Error("File is empty");
    if (file.size > MAX_BYTES) throw new Error(`Exceeds 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`);

    const call = async (payload: object) => {
      const res = await adminFetch("/api/admin/team-photos", { method: "POST", body: JSON.stringify(payload) });
      if (res.status === 401) {
        router.replace("/login");
        throw new Error("Session expired, please sign in again");
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `Server error (HTTP ${res.status})`);
      return json;
    };

    const { path, token } = await call({
      action: "sign",
      team_id: upload.team_id,
      second_team_id: upload.second_team_id || null,
      is_neutral: upload.is_neutral,
      content_type: file.type,
      size: file.size,
    });

    const { error } = await supabase.storage.from("team-photos").uploadToSignedUrl(path, token, file, {
      contentType: file.type,
    });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const { photo } = await call({
      action: "finalize",
      path,
      second_team_id: upload.second_team_id || null,
      is_neutral: upload.is_neutral,
      original_name: file.name,
    });
    setPhotos((prev) => [photo as Photo, ...prev]);
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

  const startEdit = (photo: Photo) => {
    setEditingId(photo.photo_id);
    setDraft({ team_id: photo.team_id, second_team_id: photo.second_team_id ?? "", is_neutral: photo.is_neutral });
  };

  const saveMeta = async (photo: Photo) => {
    setBusyId(photo.photo_id);
    const { ok, json } = await readResponse(
      await adminFetch("/api/admin/team-photos", {
        method: "PATCH",
        body: JSON.stringify({
          photo_id: photo.photo_id,
          team_id: draft.team_id,
          second_team_id: draft.second_team_id || null,
          is_neutral: draft.is_neutral,
        }),
      })
    );
    if (ok && json?.photo) {
      setPhotos((prev) => prev.map((p) => (p.photo_id === photo.photo_id ? (json.photo as Photo) : p)));
      setEditingId(null);
    } else {
      setNotice({ text: json?.error ?? "Update failed", kind: "error" });
    }
    setBusyId(null);
  };

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
          <TeamFields teams={teams} value={upload} disabled={uploading} onChange={setUpload} />
          <input
            type="file"
            accept={ACCEPT}
            multiple
            disabled={uploading || !upload.team_id}
            onChange={(e) => {
              startUpload(e.target.files);
              e.target.value = "";
            }}
            className="text-sm"
          />
          {uploading && <span className="text-sm text-[var(--text-muted)]">Uploading…</span>}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          JPEG, PNG or WebP, up to 10 MB each. Team 1 is the focus of the photo. Crop photos to 8:3 before uploading.
        </p>
        {results.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {results.map((r, i) => (
              <li key={`${r.name}-${i}`}>
                <span className={r.ok ? "text-green-600" : "text-red-600"}>
                  {r.ok ? "Uploaded" : "Failed"}: {r.name}
                  {r.message ? ` — ${r.message}` : ""}
                </span>
                {r.warning && <span className="block text-xs text-amber-600">Warning: {r.warning}</span>}
              </li>
            ))}
          </ul>
        )}
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
                  <span className="font-medium">
                    {teamName.get(photo.team_id) ?? photo.team_id}
                    {photo.second_team_id && (
                      <>
                        {" + "}
                        {teamName.get(photo.second_team_id) ?? photo.second_team_id}
                      </>
                    )}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {photo.is_neutral ? "Neutral · " : ""}
                    {photo.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {photo.original_name ?? "—"} · {(photo.size_bytes / 1024 / 1024).toFixed(1)} MB
                </p>
                {editingId === photo.photo_id && (
                  <div className="space-y-2 rounded border border-[var(--border)] p-2">
                    <TeamFields teams={teams} value={draft} disabled={busyId === photo.photo_id} onChange={setDraft} />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={busyId === photo.photo_id || !draft.team_id}
                        onClick={() => saveMeta(photo)}
                        className="underline disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="underline">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busyId === photo.photo_id}
                    onClick={() => startEdit(photo)}
                    className="underline hover:text-[var(--accent)] disabled:opacity-50"
                  >
                    Edit teams
                  </button>
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
