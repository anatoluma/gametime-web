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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // Fetch all player-game rows with player + team name
      const { data, error } = await supabase
        .from("player_game_stats")
        .select(
          `
          player_id,
          points,
          players (
            first_name,
            last_name,
            team_id,
            teams ( team_name )
          )
        `
        );

      if (cancelled) return;

      if (error) {
        setError(error);
        setLoading(false);
        return;
      }

      const stats = (data ?? []) as any as StatRow[];

      // Aggregate
      const map = new Map<
        string,
        { gp: number; pts: number; name: string; teamName: string }
      >();

      for (const r of stats) {
        const pid = r.player_id;
        const pts = r.points ?? 0;

        const first = r.players?.first_name ?? "";
        const last = r.players?.last_name ?? "";
        const name = `${first} ${last}`.trim() || pid;

        const teamName =
          (r.players?.teams?.team_name ?? "").trim() ||
          (r.players?.team_id ?? "").trim() ||
          "—";

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
        .filter((x) => x.gp > 0)
        // Default + only sort: PPG
        .sort((a, b) => b.ppg - a.ppg || b.gp - a.gp || b.pts - a.pts);

      setRows(leaders);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const top = useMemo(() => rows.slice(0, 50), [rows]);

  if (loading) {
    return (
      <main className="py-6 text-black">
        <h1 className="text-3xl font-bold">Leaders</h1>
        <p className="mt-2 text-black/60">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="py-6 text-black">
        <h1 className="text-3xl font-bold">Leaders</h1>
        <pre className="mt-4 text-sm text-black/80 overflow-x-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
      </main>
    );
  }

  return (
    <main className="py-6 text-black">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-bold">Leaders</h1>
        <div className="text-sm text-black/60">
          Sorted by <span className="font-semibold text-black">PPG</span>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {top.map((p, idx) => (
          <Link
            key={p.player_id}
            href={`/players/${p.player_id}`}
            className="block border border-black/20 rounded-2xl p-4 hover:bg-black/5 transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-black/60 font-semibold">#{idx + 1}</div>
                <div className="text-xl font-bold">{p.name}</div>
                <div className="text-black/60 uppercase tracking-wide">
                  {p.teamName}
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block text-xs font-bold px-2 py-1 border border-black/20 rounded bg-black/5">
                  PPG
                </div>
                <div className="text-3xl font-extrabold mt-1">
                  {p.ppg.toFixed(1)}
                </div>
              </div>
            </div>

            <div className="mt-2 text-sm text-black/60">
              GP <span className="text-black font-semibold">{p.gp}</span>
              {" • "}
              PTS <span className="text-black font-semibold">{p.pts}</span>
            </div>
          </Link>
        ))}

        {top.length === 0 && <div className="text-black/60">No data yet.</div>}
      </div>
    </main>
  );
}
