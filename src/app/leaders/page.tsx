"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Player = {
  player_id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
};

type Team = {
  team_id: string;
  team_name: string;
};

type LeaderRow = {
  player_id: string;
  team_id: string;
  player_name: string;
  gp: number;
  pts: number;
  ppg: number;
};

export default function LeadersPage() {
  const [minGames, setMinGames] = useState(1);
  const [sortBy, setSortBy] = useState<"pts" | "ppg">("ppg");
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [teamsById, setTeamsById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // teams map
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("team_id, team_name");

      if (cancelled) return;

      if (teamsError) {
        setError(teamsError);
        setLoading(false);
        return;
      }

      const tmap: Record<string, string> = {};
      (teamsData ?? []).forEach((t: Team) => (tmap[t.team_id] = t.team_name));
      setTeamsById(tmap);

      // player_game_stats
      const { data: pgs, error: pgsError } = await supabase
        .from("player_game_stats")
        .select("player_id, team_id, points");

      if (cancelled) return;

      if (pgsError) {
        setError(pgsError);
        setLoading(false);
        return;
      }

      // aggregate stats
      const agg = new Map<
        string,
        { player_id: string; team_id: string; gp: number; pts: number }
      >();

      (pgs ?? []).forEach((r: any) => {
        const player_id = r.player_id as string;
        const team_id = r.team_id as string;
        const pts = (r.points ?? 0) as number;

        const cur = agg.get(player_id);
        if (!cur) {
          agg.set(player_id, { player_id, team_id, gp: 1, pts });
        } else {
          // keep last seen team_id (fine for now; later we can do season/team split)
          cur.team_id = team_id;
          cur.gp += 1;
          cur.pts += pts;
        }
      });

      const playerIds = Array.from(agg.keys());
      if (playerIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // load players for names
      const { data: playersData, error: playersError } = await supabase
        .from("players")
        .select("player_id, team_id, first_name, last_name, jersey_number")
        .in("player_id", playerIds);

      if (cancelled) return;

      if (playersError) {
        setError(playersError);
        setLoading(false);
        return;
      }

      const pmap = new Map<string, Player>();
      (playersData ?? []).forEach((p: any) => pmap.set(p.player_id, p as Player));

      const out: LeaderRow[] = [];
      agg.forEach((v) => {
        const p = pmap.get(v.player_id);
        const name = p ? `${p.first_name} ${p.last_name}` : v.player_id;

        const gp = v.gp;
        const pts = v.pts;
        const ppg = gp > 0 ? pts / gp : 0;

        out.push({
          player_id: v.player_id,
          team_id: p?.team_id ?? v.team_id,
          player_name: name,
          gp,
          pts,
          ppg,
        });
      });

      setRows(out);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSorted = useMemo(() => {
    const filtered = rows.filter((r) => r.gp >= minGames);
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "pts") return b.pts - a.pts;
      return b.ppg - a.ppg;
    });
    return sorted.slice(0, 50);
  }, [rows, minGames, sortBy]);

  if (loading) {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-bold">Leaders</h1>
        <p className="mt-2 text-gray-600">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-bold">Leaders</h1>
        <pre className="mt-4 text-sm">{JSON.stringify(error, null, 2)}</pre>
      </main>
    );
  }

  return (
    <main className="p-8">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">Leaders</h1>

        <div className="flex gap-3 items-center">
          <label className="text-sm text-gray-600">
            Min games:
            <input
              className="ml-2 border rounded px-2 py-1 w-16"
              type="number"
              min={1}
              value={minGames}
              onChange={(e) => setMinGames(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>

          <label className="text-sm text-gray-600">
            Sort:
            <select
              className="ml-2 border rounded px-2 py-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="ppg">PPG</option>
              <option value="pts">Total PTS</option>
            </select>
          </label>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden mt-6">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 w-16">#</th>
              <th className="p-3">Player</th>
              <th className="p-3">Team</th>
              <th className="p-3 w-20 text-right">GP</th>
              <th className="p-3 w-24 text-right">PTS</th>
              <th className="p-3 w-24 text-right">PPG</th>
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((r, idx) => (
              <tr key={r.player_id} className="border-t">
                <td className="p-3">{idx + 1}</td>
                <td className="p-3">
                  <Link href={`/players/${r.player_id}`} className="hover:underline">
                    {r.player_name}
                  </Link>
                </td>
                <td className="p-3">
                  <Link href={`/teams/${r.team_id}`} className="hover:underline">
                    {teamsById[r.team_id] ?? r.team_id}
                  </Link>
                </td>
                <td className="p-3 text-right">{r.gp}</td>
                <td className="p-3 text-right font-semibold">{r.pts}</td>
                <td className="p-3 text-right font-semibold">{r.ppg.toFixed(1)}</td>
              </tr>
            ))}

            {filteredSorted.length === 0 && (
              <tr className="border-t">
                <td className="p-3" colSpan={6}>
                  No data for selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
