"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PlayerAvatar from "@/app/components/PlayerAvatar";
import SeasonSelector from "@/app/components/SeasonSelector";
import { useT } from "@/app/components/LanguageProvider";
import type { Season } from "@/lib/league";
import RankBadge from "@/app/components/home/RankBadge";
import SectionHeading from "@/app/components/home/SectionHeading";

type StatRow = {
  player_id: string;
  points: number | null;
  players: {
    first_name: string | null;
    last_name: string | null;
    team_id: string | null;
    teams?: { team_name: string | null } | null;
  } | null;
};

type LeaderRow = {
  player_id: string;
  name: string;
  teamName: string;
  gp: number;
  pts: number;
  ppg: number;
};

export default function LeadersPage() {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"PTS" | "PPG">("PTS");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const { t } = useT();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Derive selected season from URL; fall back to is_current once seasons load
  const seasonParam = searchParams.get("season");
  const currentSeason = seasonParam ?? seasons.find((s) => s.is_current)?.season ?? seasons[0]?.season ?? "2025/26";

  // Load available seasons once
  useEffect(() => {
    supabase
      .from("seasons")
      .select("season, is_current")
      .order("season", { ascending: false })
      .then(({ data }) => setSeasons((data ?? []) as Season[]));
  }, []);

  // When seasons load and there's no URL param, set the default in the URL
  useEffect(() => {
    if (seasonParam || seasons.length === 0) return;
    const defaultSeason = seasons.find((s) => s.is_current)?.season ?? seasons[0]?.season;
    if (!defaultSeason) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", defaultSeason);
    router.replace(`${pathname}?${params.toString()}`);
  }, [seasons, seasonParam, pathname, router, searchParams]);

  useEffect(() => {
    if (!currentSeason) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);

      const stats: StatRow[] = [];
      const statsPageSize = 1000;
      for (let start = 0; ; start += statsPageSize) {
        const { data, error } = await supabase
          .from("player_game_stats")
          .select(`
            player_id,
            points,
            players (
              first_name,
              last_name,
              team_id,
              teams ( team_name )
            )
          `)
          .order("game_id")
          .order("player_id")
          .range(start, start + statsPageSize - 1);

        if (cancelled) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        const page = (data ?? []) as unknown as StatRow[];
        stats.push(...page);
        if (page.length < statsPageSize) break;
      }

      const map = new Map<string, { gp: number; pts: number; name: string; teamName: string }>();

      for (const r of stats) {
        const pid = r.player_id;
        const pts = r.points ?? 0;
        const first = r.players?.first_name ?? "";
        const last = r.players?.last_name ?? "";
        const name = `${first} ${last}`.trim() || pid;
        const teamName = (r.players?.teams?.team_name ?? "").trim() || (r.players?.team_id ?? "").trim() || "—";

        const cur = map.get(pid);
        if (!cur) {
          map.set(pid, { gp: 1, pts, name, teamName });
        } else {
          cur.gp += 1;
          cur.pts += pts;
        }
      }

      const leaders: LeaderRow[] = Array.from(map.entries())
        .map(([player_id, v]) => ({
          player_id,
          name: v.name,
          teamName: v.teamName,
          gp: v.gp,
          pts: v.pts,
          ppg: v.gp > 0 ? v.pts / v.gp : 0,
        }))
        .filter((x) => x.gp > 0);
      setRows(leaders);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [currentSeason]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    if (sortMode === "PPG") {
      arr.sort((a, b) => b.ppg - a.ppg || b.gp - a.gp || b.pts - a.pts);
    } else {
      arr.sort((a, b) => b.pts - a.pts || b.gp - a.gp || b.ppg - a.ppg);
    }
    return arr;
  }, [rows, sortMode]);

  const top = useMemo(() => sorted.slice(0, 50), [sorted]);

  if (loading) return <main className="py-6 px-2 max-w-4xl mx-auto" style={{ color: "var(--text)" }}><h1 className="text-3xl uppercase" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{t("leaders_title")}</h1><p className="mt-4 animate-pulse font-bold" style={{ color: "var(--muted)" }}>{t("leaders_loading")}</p></main>;

  if (error) return <main className="py-6 px-2 max-w-4xl mx-auto" style={{ color: "var(--text)" }}><h1 className="text-3xl uppercase" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{t("leaders_title")}</h1><p className="mt-4 font-bold text-red-400">{error}</p></main>;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6" style={{ background: "var(--navy-950)", color: "var(--text)" }}>
      <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl uppercase leading-none" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{t("leaders_title")}</h1>
        <div className="flex items-center gap-3">
          {seasons.length > 0 && currentSeason && (
            <SeasonSelector seasons={seasons} currentSeason={currentSeason} />
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{t("leaders_sort_by")}</span>
            <button onClick={() => setSortMode("PTS")} className="rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors" style={sortMode === "PTS" ? { background: "var(--orange)", color: "#1f1309", borderRadius: "var(--radius)" } : { background: "var(--navy-800)", color: "var(--muted)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>PTS</button>
            <button onClick={() => setSortMode("PPG")} className="rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors" style={sortMode === "PPG" ? { background: "var(--orange)", color: "#1f1309", borderRadius: "var(--radius)" } : { background: "var(--navy-800)", color: "var(--muted)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>PPG</button>
          </div>
        </div>
      </div>

      <SectionHeading title={t("home_section_leaders")} href="/leaders" linkLabel={t("home_leaders_full")} headingClassName="text-lg" />

      <div className="space-y-2">
        {top.map((p, idx) => (
          <Link
            key={p.player_id}
            href={`/players/${p.player_id}`}
            className="group block border p-3 transition-colors hover:border-[var(--orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)]"
            style={{
              borderColor: "var(--line)",
              borderRadius: "var(--radius)",
              background: "var(--navy-800)",
            }}
          >
            {/* GRID LAYOUT: Left side expands, Right side (Stats) is fixed */}
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              
              {/* LEFT: PLAYER INFO (Wrapped text) */}
              <div className="min-w-0 flex items-center gap-3">
                <PlayerAvatar
                  playerId={p.player_id}
                  playerName={p.name}
                  width={52}
                  height={65}
                  className="w-11 h-14 rounded-lg border border-black/10 bg-white object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="mb-0.5"><RankBadge rank={idx + 1} /></div>
                  <div className="break-words text-base font-semibold uppercase leading-tight tracking-tight transition-colors group-hover:text-[var(--orange)]" style={{ color: "var(--text)" }}>
                    {p.name}
                  </div>
                  <div className="text-[9px] font-semibold uppercase tracking-widest leading-tight break-words" style={{ color: "var(--muted)" }}>
                    {p.teamName}
                  </div>
                </div>
              </div>

              {/* RIGHT: ALIGNED STATS COLUMNS (Fixed Width) */}
              <div className="flex items-center gap-3 border-l pl-2 sm:gap-6" style={{ borderColor: "var(--line)" }}>
                <div className="text-center w-[35px] sm:w-[50px]">
                  <div className="text-[8px] font-semibold uppercase" style={{ color: "var(--muted)" }}>PTS</div>
                  <div className="tabular-nums text-base leading-none sm:text-xl" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{p.pts}</div>
                </div>
                <div className="text-center w-[25px] sm:w-[40px]">
                  <div className="text-[8px] font-semibold uppercase" style={{ color: "var(--muted)" }}>GP</div>
                  <div className="tabular-nums text-base leading-none sm:text-xl" style={{ color: "var(--text)", fontFamily: "var(--font-display)", fontWeight: 600 }}>{p.gp}</div>
                </div>
                <div className="text-center w-[35px] sm:w-[50px]">
                  <div className="text-[8px] font-semibold uppercase" style={{ color: "var(--muted)" }}>PPG</div>
                  <div className="tabular-nums text-base leading-none sm:text-xl" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                    {p.ppg.toFixed(1)}
                  </div>
                </div>
              </div>

            </div>
          </Link>
        ))}

        {top.length === 0 && <div className="py-20 text-center text-2xl font-semibold uppercase" style={{ color: "var(--muted)" }}>{t("leaders_no_data")}</div>}
      </div>
      </div>
    </main>
  );
}