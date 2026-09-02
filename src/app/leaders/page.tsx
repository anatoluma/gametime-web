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

// One row per (player, season) from the player_season_stats DB view
type SeasonStatRow = {
  player_id: string;
  team_id: string | null;
  gp: number;
  pts: number | null;
  ppg: number | null;
  reb: number | null;
  rpg: number | null;
  ast: number | null;
  apg: number | null;
  stl: number | null;
  spg: number | null;
  blk: number | null;
  bpg: number | null;
  fg_made: number | null;
  fg_att: number | null;
  fg_pct: number | null;
  three_made: number | null;
  three_att: number | null;
  three_pct: number | null;
};

type LeaderRow = SeasonStatRow & {
  name: string;
  teamName: string;
  photoUrl: string | null;
};

type Category = "PTS" | "REB" | "AST" | "STL" | "BLK" | "FG_PCT" | "3PM" | "3P_PCT";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "PTS", label: "PTS" },
  { key: "REB", label: "REB" },
  { key: "AST", label: "AST" },
  { key: "STL", label: "STL" },
  { key: "BLK", label: "BLK" },
  { key: "FG_PCT", label: "FG%" },
  { key: "3PM", label: "3PM" },
  { key: "3P_PCT", label: "3P%" },
];

function sortRows(rows: LeaderRow[], category: Category, ptsSortMode: "PTS" | "PPG") {
  const arr = [...rows];
  switch (category) {
    case "PTS":
      if (ptsSortMode === "PPG") {
        arr.sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0) || b.gp - a.gp || (b.pts ?? 0) - (a.pts ?? 0));
      } else {
        arr.sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0) || b.gp - a.gp || (b.ppg ?? 0) - (a.ppg ?? 0));
      }
      return arr;
    case "REB":
      return arr.sort((a, b) => (b.rpg ?? 0) - (a.rpg ?? 0) || (b.reb ?? 0) - (a.reb ?? 0));
    case "AST":
      return arr.sort((a, b) => (b.apg ?? 0) - (a.apg ?? 0) || (b.ast ?? 0) - (a.ast ?? 0));
    case "STL":
      return arr.sort((a, b) => (b.spg ?? 0) - (a.spg ?? 0) || (b.stl ?? 0) - (a.stl ?? 0));
    case "BLK":
      return arr.sort((a, b) => (b.bpg ?? 0) - (a.bpg ?? 0) || (b.blk ?? 0) - (a.blk ?? 0));
    case "FG_PCT":
      // Only players with attempts can qualify for a shooting percentage leaderboard
      return arr
        .filter((r) => (r.fg_att ?? 0) > 0)
        .sort((a, b) => (b.fg_pct ?? 0) - (a.fg_pct ?? 0) || (b.fg_made ?? 0) - (a.fg_made ?? 0));
    case "3PM":
      return arr.sort((a, b) => (b.three_made ?? 0) - (a.three_made ?? 0));
    case "3P_PCT":
      return arr
        .filter((r) => (r.three_att ?? 0) > 0)
        .sort((a, b) => (b.three_pct ?? 0) - (a.three_pct ?? 0) || (b.three_made ?? 0) - (a.three_made ?? 0));
  }
}

function StatFooter({ row, category }: { row: LeaderRow; category: Category }) {
  const cellStyle = { color: "var(--muted)" } as const;
  const bigOrange = { color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 } as const;
  const bigText = { color: "var(--text)", fontFamily: "var(--font-display)", fontWeight: 600 } as const;

  const cols: { label: string; value: string; big?: boolean }[] = (() => {
    switch (category) {
      case "PTS":
        return [
          { label: "PTS", value: String(row.pts ?? 0), big: true },
          { label: "GP", value: String(row.gp) },
          { label: "PPG", value: (row.ppg ?? 0).toFixed(1) },
        ];
      case "REB":
        return [
          { label: "RPG", value: (row.rpg ?? 0).toFixed(1), big: true },
          { label: "GP", value: String(row.gp) },
          { label: "REB", value: String(row.reb ?? 0) },
        ];
      case "AST":
        return [
          { label: "APG", value: (row.apg ?? 0).toFixed(1), big: true },
          { label: "GP", value: String(row.gp) },
          { label: "AST", value: String(row.ast ?? 0) },
        ];
      case "STL":
        return [
          { label: "SPG", value: (row.spg ?? 0).toFixed(1), big: true },
          { label: "GP", value: String(row.gp) },
          { label: "STL", value: String(row.stl ?? 0) },
        ];
      case "BLK":
        return [
          { label: "BPG", value: (row.bpg ?? 0).toFixed(1), big: true },
          { label: "GP", value: String(row.gp) },
          { label: "BLK", value: String(row.blk ?? 0) },
        ];
      case "FG_PCT":
        return [
          { label: "FG%", value: (row.fg_pct ?? 0).toFixed(1), big: true },
          { label: "GP", value: String(row.gp) },
          { label: "FGM-FGA", value: `${row.fg_made ?? 0}-${row.fg_att ?? 0}` },
        ];
      case "3PM":
        return [
          { label: "3PM", value: String(row.three_made ?? 0), big: true },
          { label: "GP", value: String(row.gp) },
          { label: "3P%", value: (row.three_pct ?? 0).toFixed(1) },
        ];
      case "3P_PCT":
        return [
          { label: "3P%", value: (row.three_pct ?? 0).toFixed(1), big: true },
          { label: "GP", value: String(row.gp) },
          { label: "3PM-3PA", value: `${row.three_made ?? 0}-${row.three_att ?? 0}` },
        ];
    }
  })();

  return (
    <div className="flex items-center gap-3 border-l pl-2 sm:gap-6" style={{ borderColor: "var(--line)" }}>
      {cols.map((c) => (
        <div key={c.label} className="text-center w-[35px] sm:w-[55px]">
          <div className="text-[8px] font-semibold uppercase" style={cellStyle}>{c.label}</div>
          <div className="tabular-nums text-base leading-none sm:text-xl" style={c.big ? bigOrange : bigText}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function LeadersPage() {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("PTS");
  const [ptsSortMode, setPtsSortMode] = useState<"PTS" | "PPG">("PTS");
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

      const { data: statRows, error: statsError } = await supabase
        .from("player_season_stats")
        .select("*")
        .eq("season", currentSeason);

      if (cancelled) return;
      if (statsError) {
        setError(statsError.message);
        setLoading(false);
        return;
      }

      const seasonStats = (statRows ?? []) as SeasonStatRow[];
      const playerIds = Array.from(new Set(seasonStats.map((s) => s.player_id)));

      if (playerIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const [{ data: playersData }, { data: teamsData }] = await Promise.all([
        supabase.from("players").select("player_id, first_name, last_name, team_id, photo_url").in("player_id", playerIds),
        supabase.from("teams").select("team_id, team_name"),
      ]);

      if (cancelled) return;

      type PlayerRow = { player_id: string; first_name: string | null; last_name: string | null; team_id: string | null; photo_url: string | null };
      type TeamRow = { team_id: string; team_name: string | null };

      const playerById = new Map((playersData ?? []).map((p: PlayerRow) => [p.player_id, p]));
      const teamNameById = new Map((teamsData ?? []).map((tm: TeamRow) => [tm.team_id, tm.team_name]));

      const leaders: LeaderRow[] = seasonStats.map((s) => {
        const p = playerById.get(s.player_id);
        const name = p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || s.player_id : s.player_id;
        const teamId = p?.team_id ?? s.team_id ?? "";
        const teamName = teamNameById.get(teamId) ?? teamId ?? "—";
        const photoUrl = p?.photo_url ?? null;
        return { ...s, name, teamName, photoUrl };
      });

      setRows(leaders);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [currentSeason]);

  const sorted = useMemo(() => sortRows(rows, category, ptsSortMode), [rows, category, ptsSortMode]);
  const top = useMemo(() => sorted.slice(0, 50), [sorted]);

  if (loading) return <main className="py-6 px-2 max-w-4xl mx-auto" style={{ color: "var(--text)" }}><h1 className="text-3xl uppercase" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{t("leaders_title")}</h1><p className="mt-4 animate-pulse font-bold" style={{ color: "var(--muted)" }}>{t("leaders_loading")}</p></main>;

  if (error) return <main className="py-6 px-2 max-w-4xl mx-auto" style={{ color: "var(--text)" }}><h1 className="text-3xl uppercase" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{t("leaders_title")}</h1><p className="mt-4 font-bold text-red-400">{error}</p></main>;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6" style={{ background: "var(--navy-950)", color: "var(--text)" }}>
      <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl uppercase leading-none" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{t("leaders_title")}</h1>
        {seasons.length > 0 && currentSeason && (
          <SeasonSelector seasons={seasons} currentSeason={currentSeason} />
        )}
      </div>

      {/* CATEGORY TABS */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className="shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors"
            style={category === c.key
              ? { background: "var(--orange)", color: "#1f1309", borderRadius: "var(--radius)" }
              : { background: "var(--navy-800)", color: "var(--muted)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {category === "PTS" && (
        <div className="mb-4 flex items-center gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{t("leaders_sort_by")}</span>
          <button onClick={() => setPtsSortMode("PTS")} className="rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors" style={ptsSortMode === "PTS" ? { background: "var(--orange)", color: "#1f1309", borderRadius: "var(--radius)" } : { background: "var(--navy-800)", color: "var(--muted)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>PTS</button>
          <button onClick={() => setPtsSortMode("PPG")} className="rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors" style={ptsSortMode === "PPG" ? { background: "var(--orange)", color: "#1f1309", borderRadius: "var(--radius)" } : { background: "var(--navy-800)", color: "var(--muted)", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>PPG</button>
        </div>
      )}

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
                  photoUrl={p.photoUrl}
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
              <StatFooter row={p} category={category} />

            </div>
          </Link>
        ))}

        {top.length === 0 && <div className="py-20 text-center text-2xl font-semibold uppercase" style={{ color: "var(--muted)" }}>{t("leaders_no_data")}</div>}
      </div>
      </div>
    </main>
  );
}