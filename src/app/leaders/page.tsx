"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

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
  const [error, setError] = useState<any>(null);
  const [sortMode, setSortMode] = useState<"PTS" | "PPG">("PTS");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
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
        `);

      if (cancelled) return;
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      const stats = (data ?? []) as unknown as StatRow[];
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
  }, []);

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

  if (loading) return <main className="py-6 text-black px-2 max-w-4xl mx-auto"><h1 className="text-3xl font-black italic uppercase">Leaders</h1><p className="mt-4 animate-pulse font-bold text-gray-400">LOADING STATS...</p></main>;

  return (
    <main className="py-4 text-black px-2 max-w-4xl mx-auto min-h-screen bg-white">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-6 border-b-4 border-black pb-4">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-black">League Leaders</h1>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Sort By</span>
          <button onClick={() => setSortMode("PTS")} className={`px-2.5 py-1 rounded-full text-[9px] font-black transition-all ${sortMode === "PTS" ? "bg-black text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>PTS</button>
          <button onClick={() => setSortMode("PPG")} className={`px-2.5 py-1 rounded-full text-[9px] font-black transition-all ${sortMode === "PPG" ? "bg-black text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>PPG</button>
        </div>
      </div>

      <div className="space-y-2">
        {top.map((p, idx) => (
          <Link
            key={p.player_id}
            href={`/players/${p.player_id}`}
            className="group block border-2 border-black/10 rounded-xl p-3 hover:border-black hover:bg-orange-50 transition-all shadow-sm"
          >
            {/* GRID LAYOUT: Left side expands, Right side (Stats) is fixed */}
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              
              {/* LEFT: PLAYER INFO (Wrapped text) */}
              <div className="min-w-0">
                <div className="text-[9px] font-black text-gray-300 italic mb-0.5 uppercase tracking-tighter">#{idx + 1}</div>
                <div className="text-base font-black uppercase italic tracking-tight leading-tight group-hover:text-orange-600 transition-colors text-black break-words">
                  {p.name}
                </div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-tight break-words">
                  {p.teamName}
                </div>
              </div>

              {/* RIGHT: ALIGNED STATS COLUMNS (Fixed Width) */}
              <div className="flex items-center border-l-2 border-gray-50 pl-2 gap-3 sm:gap-6">
                <div className="text-center w-[35px] sm:w-[50px]">
                  <div className="text-[8px] font-black text-gray-400 uppercase">PTS</div>
                  <div className="text-base sm:text-xl font-black italic text-black tabular-nums">{p.pts}</div>
                </div>
                <div className="text-center w-[25px] sm:w-[40px]">
                  <div className="text-[8px] font-black text-gray-400 uppercase">GP</div>
                  <div className="text-base sm:text-xl font-black italic text-black tabular-nums">{p.gp}</div>
                </div>
                <div className="text-center w-[35px] sm:w-[50px]">
                  <div className="text-[8px] font-black text-orange-600 uppercase">PPG</div>
                  <div className="text-base sm:text-xl font-black italic text-orange-600 tabular-nums">
                    {p.ppg.toFixed(1)}
                  </div>
                </div>
              </div>

            </div>
          </Link>
        ))}

        {top.length === 0 && <div className="text-center py-20 font-black text-gray-200 uppercase italic text-2xl">No data yet</div>}
      </div>
    </main>
  );
}