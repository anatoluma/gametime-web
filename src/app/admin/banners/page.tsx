"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-fetch";
import BannerCard from "./BannerCard";
import { gameLabel, type AdminBanner, type Game, type PhotoChoice, type Team } from "./types";

type Notice = { text: string; kind: "success" | "error" } | null;

export default function AdminBannersPage() {
  const router = useRouter();
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [newGameId, setNewGameId] = useState("");
  const [newHeadline, setNewHeadline] = useState("");

  const call = useCallback(
    async (url: string, init?: RequestInit) => {
      const res = await adminFetch(url, init);
      if (res.status === 401) {
        router.replace("/login");
        return { ok: false, json: null };
      }
      return { ok: res.ok, json: await res.json().catch(() => null) };
    },
    [router]
  );

  const load = useCallback(async () => {
    const { ok, json } = await call("/api/admin/banners");
    if (ok && json) {
      setBanners(json.banners);
      setGames(json.games);
      setTeams(json.teams);
    } else if (json) {
      setNotice({ text: json.error ?? "Failed to load banners", kind: "error" });
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const teamNames = useMemo(() => new Map(teams.map((t) => [t.team_id, t.team_name ?? t.team_id])), [teams]);
  const approved = useMemo(
    () => banners.filter((b) => b.status === "approved").sort((a, b) => a.sort_order - b.sort_order),
    [banners]
  );
  const others = banners.filter((b) => b.status !== "approved");
  const bannerByGame = useMemo(() => new Map(banners.map((b) => [b.game_id, b])), [banners]);

  /** Runs a mutation, then reloads so the UI always reflects the server's state. */
  const run = async (busyKey: string, request: () => Promise<{ ok: boolean; json: { error?: string } | null }>, success: string) => {
    setBusyId(busyKey);
    setNotice(null);
    const { ok, json } = await request();
    setNotice({ text: ok ? success : (json?.error ?? "Request failed"), kind: ok ? "success" : "error" });
    await load();
    setBusyId(null);
  };

  const generate = (gameId: string, headline: string, photo: PhotoChoice, busyKey: string) =>
    run(
      busyKey,
      () =>
        call("/api/admin/banners", {
          method: "POST",
          body: JSON.stringify({ game_id: gameId, headline: headline.trim() || null, photo }),
        }),
      "Draft generated."
    );

  const act = (banner: AdminBanner, action: "approve" | "reject" | "unpublish") =>
    run(
      banner.banner_id,
      () => call(`/api/admin/banners/${banner.banner_id}`, { method: "POST", body: JSON.stringify({ action }) }),
      { approve: "Published.", reject: "Rejected.", unpublish: "Unpublished." }[action]
    );

  const move = (banner: AdminBanner, direction: -1 | 1) => {
    const ids = approved.map((b) => b.banner_id);
    const from = ids.indexOf(banner.banner_id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    return run(
      banner.banner_id,
      () => call("/api/admin/banners/reorder", { method: "POST", body: JSON.stringify({ ids }) }),
      "Order saved."
    );
  };

  const field = "rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]";

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Homepage banners</h1>
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
        <h2 className="mb-3 text-lg font-medium">New banner</h2>
        <div className="flex flex-wrap gap-3">
          <select value={newGameId} onChange={(e) => setNewGameId(e.target.value)} className={`${field} min-w-64 flex-1`}>
            <option value="">Select a completed game…</option>
            {games.map((game) => (
              <option key={game.game_id} value={game.game_id}>
                {gameLabel(game, teamNames, game.game_id)}
                {bannerByGame.has(game.game_id) ? ` [${bannerByGame.get(game.game_id)!.status}]` : ""}
              </option>
            ))}
          </select>
          <input
            value={newHeadline}
            maxLength={80}
            onChange={(e) => setNewHeadline(e.target.value)}
            placeholder="Headline (optional)"
            className={`${field} min-w-48 flex-1`}
          />
          <button
            type="button"
            disabled={!newGameId || busyId !== null}
            onClick={async () => {
              await generate(newGameId, newHeadline, "auto", "new");
              setNewGameId("");
              setNewHeadline("");
            }}
            className="rounded border border-orange-500 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 disabled:opacity-50"
          >
            {busyId === "new" ? "Rendering…" : "Generate draft"}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Choosing a game that already has a draft re-renders it. Published banners must be unpublished first.
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (
        <>
          <h2 className="mb-3 text-lg font-medium">Published ({approved.length}) — carousel shows the first 5</h2>
          {approved.length === 0 ? (
            <p className="mb-8 text-sm text-[var(--text-muted)]">Nothing published. The homepage hides the carousel.</p>
          ) : (
            <ul className="mb-8 space-y-4">
              {approved.map((banner, index) => (
                <BannerCard
                  key={`${banner.banner_id}-${banner.image_version}`}
                  banner={banner}
                  teams={teamNames}
                  busy={busyId === banner.banner_id}
                  position={{ index, total: approved.length }}
                  onRegenerate={() => undefined}
                  onAction={(action) => act(banner, action)}
                  onMove={(direction) => move(banner, direction)}
                />
              ))}
            </ul>
          )}

          <h2 className="mb-3 text-lg font-medium">Drafts &amp; rejected ({others.length})</h2>
          {others.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No drafts yet.</p>
          ) : (
            <ul className="space-y-4">
              {others.map((banner) => (
                <BannerCard
                  key={`${banner.banner_id}-${banner.image_version}`}
                  banner={banner}
                  teams={teamNames}
                  busy={busyId === banner.banner_id}
                  position={null}
                  onRegenerate={(headline, photo) => generate(banner.game_id, headline, photo, banner.banner_id)}
                  onAction={(action) => act(banner, action)}
                  onMove={() => undefined}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
