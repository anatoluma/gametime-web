"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import { gameLabel, type AdminBanner, type PhotoChoice } from "./types";

type Photo = { photo_id: string; team_id: string; second_team_id: string | null; is_active: boolean; url: string };

type Props = {
  banner: AdminBanner;
  teams: Map<string, string>;
  busy: boolean;
  /** Position among published banners, or null when not published. */
  position: { index: number; total: number } | null;
  onRegenerate: (headline: string, photo: PhotoChoice) => void;
  onAction: (action: "approve" | "reject" | "unpublish") => void;
  onMove: (direction: -1 | 1) => void;
};

const STATUS_STYLE: Record<AdminBanner["status"], string> = {
  draft: "border-amber-500 text-amber-600",
  approved: "border-green-500 text-green-600",
  rejected: "border-red-400 text-red-600",
};

export default function BannerCard({ banner, teams, busy, position, onRegenerate, onAction, onMove }: Props) {
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState(banner.headline ?? "");
  const [choice, setChoice] = useState<PhotoChoice>(banner.photo_id ?? "auto");
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const published = banner.status === "approved";
  const image = banner.preview_url ?? banner.published_url;

  const openEditor = async () => {
    setEditing(true);
    if (photos || !banner.game) return;
    try {
      const lists = await Promise.all(
        [banner.game.home_team_id, banner.game.away_team_id].map(async (id) => {
          const res = await adminFetch(`/api/admin/team-photos?team_id=${encodeURIComponent(id)}`);
          const json = await res.json().catch(() => null);
          if (!res.ok) throw new Error(json?.error ?? "Failed to load photos");
          return (json.photos as Photo[]).filter((p) => p.is_active);
        })
      );
      const matchup = [banner.game.home_team_id, banner.game.away_team_id];
      const unique = new Map<string, Photo>();
      for (const photo of lists.flat()) unique.set(photo.photo_id, photo);
      // Photos of a third team never qualify; two-team photos are matched regardless of order.
      setPhotos(
        [...unique.values()].filter(
          (p) => matchup.includes(p.team_id) && (!p.second_team_id || matchup.includes(p.second_team_id))
        )
      );
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Failed to load photos");
    }
  };

  const btn = "rounded border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)] disabled:opacity-50";
  const teamName = (id: string) => teams.get(id) ?? id;

  return (
    <li className="overflow-hidden rounded-lg border border-[var(--border)]">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="aspect-[8/3] w-full object-cover bg-black" />
      ) : (
        <div className="flex aspect-[8/3] items-center justify-center bg-black text-sm text-white/60">No image</div>
      )}

      <div className="space-y-3 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">
            {gameLabel(banner.game, teams, banner.game_id)}
          </span>
          <span className={`rounded border px-2 py-0.5 text-xs uppercase ${STATUS_STYLE[banner.status]}`}>
            {banner.status}
            {position ? ` · #${position.index + 1}` : ""}
          </span>
        </div>

        {banner.outdated && (
          <p className="rounded border border-amber-500 px-3 py-2 text-xs text-amber-600">
            {published
              ? "The game's teams or score changed after this banner was published. It was not changed automatically; unpublish and regenerate it to update the image."
              : "The game's teams or score changed after this image was generated. Regenerate it."}
          </p>
        )}

        <p className="text-xs text-[var(--text-muted)]">
          {banner.headline ? `Headline: “${banner.headline}”` : "No headline"} · v{banner.image_version}
          {banner.reviewed_by ? ` · reviewed by ${banner.reviewed_by}` : ""}
        </p>

        {editing && (
          <div className="space-y-3 rounded border border-[var(--border)] p-3">
            {published && (
              <p className="text-xs text-amber-600">Published banners are locked. Unpublish to change the headline or photo.</p>
            )}
            <label className="block">
              <span className="mb-1 block text-xs">Headline (optional, max 80)</span>
              <input
                value={headline}
                maxLength={80}
                disabled={published}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>

            <div>
              <span className="mb-1 block text-xs">Photo</span>
              {photoError && <p className="text-xs text-red-600">{photoError}</p>}
              <div className="flex flex-wrap gap-2">
                {(["auto", "none"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={published}
                    onClick={() => setChoice(value)}
                    className={`rounded border px-3 py-2 text-xs ${choice === value ? "border-orange-500 bg-orange-500/10" : "border-[var(--border)]"}`}
                  >
                    {value === "auto" ? "Auto (best match first)" : "No photo"}
                  </button>
                ))}
                {photos?.map((photo) => (
                  <button
                    key={photo.photo_id}
                    type="button"
                    disabled={published}
                    onClick={() => setChoice(photo.photo_id)}
                    aria-pressed={choice === photo.photo_id}
                    className={`overflow-hidden rounded border-2 ${choice === photo.photo_id ? "border-orange-500" : "border-transparent"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={`${teamName(photo.team_id)} photo`} loading="lazy" className="h-16 w-24 object-cover" />
                    <span className="block bg-black/70 px-1 text-[10px] text-white">{photo.second_team_id ? `${photo.team_id} + ${photo.second_team_id}` : photo.team_id}</span>
                  </button>
                ))}
                {!photos && !photoError && <span className="text-xs text-[var(--text-muted)]">Loading photos…</span>}
              </div>
            </div>

            <button type="button" disabled={busy || published} onClick={() => onRegenerate(headline, choice)} className={btn}>
              {busy ? "Rendering…" : "Regenerate"}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!published && (
            <button type="button" disabled={busy || !banner.preview_url} onClick={() => onAction("approve")} className={`${btn} border-green-600 text-green-700`}>
              Approve &amp; publish
            </button>
          )}
          {banner.status === "draft" && (
            <button type="button" disabled={busy} onClick={() => onAction("reject")} className={`${btn} text-red-600`}>
              Reject
            </button>
          )}
          {(published || banner.published_path) && (
            <button type="button" disabled={busy} onClick={() => onAction("unpublish")} className={btn}>
              Unpublish
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => (editing ? setEditing(false) : openEditor())} className={btn}>
            {editing ? "Close editor" : "Edit / regenerate"}
          </button>
          {position && (
            <>
              <button type="button" disabled={busy || position.index === 0} onClick={() => onMove(-1)} aria-label="Move earlier" className={btn}>
                ↑
              </button>
              <button
                type="button"
                disabled={busy || position.index === position.total - 1}
                onClick={() => onMove(1)}
                aria-label="Move later"
                className={btn}
              >
                ↓
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
