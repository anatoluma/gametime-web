"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

type StatRow = {
  game_id: string;
  points: number | null;
};

type GameRow = {
  game_id: string;
  tipoff: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

export default function PlayerPage() {
  const params = useParams();

  const playerId = useMemo(() => {
    const raw = (params as any)?.player_id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [gamesById, setGamesById] = useState<Record<string, GameRow>>({});
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!playerId) return;

      setLoading(true);
      setError(null);

      // 1) Player
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("player_id, team_id, first_name, last_name, jersey_number")
        .eq("player_id", playerId)
        .maybeSingle();

      if (cancelled) return;

      if (playerError || !playerData) {
        setError(playerError ?? { message: "Player not found" });
        setLoading(false);
        return;
      }

      setPlayer(playerData as Player);

      // 2) Team name
      const { data: teamData } = await supabase
        .from("teams")
        .select("team_id, team_name")
        .eq("team_id", (playerData as Player).team_id)
        .maybeSingle();

      if (!cancelled) setTeam((teamData as Team) ?? null);

      // 3) Player game stats
      const { data: statsData, error: statsError } = await supabase
        .from("player_game_stats")
        .select("game_id, points")
        .eq("player_id", playerId);

      if (cancelled) return;

      if (statsError) {
        setError(statsError);
        setLoading(false);
        return;
      }

      const statRows = (statsData ?? []) as StatRow[];
      setStats(statRows);

      // 4) Load games referenced by these stats
      const gameIds = Array.from(new Set(statRows.map((s) => s.game_id)));
      if (gameIds.length === 0) {
        setGamesById({});
        setLoading(false);
        return;
      }

      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select("game_id, tipoff, home_team_id, away_team_id, home_score, away_score")
        .in("game_id", gameIds);

      if (cancelled) return;

      if (gamesError) {
        setError(gamesError);
        setLoading(false);
        return;
      }

      const map: Record<string, GameRow> = {};
      (gamesData ?? []).forEach((g: any) => (map[g.game_id] = g));
      setGamesById(map);

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  if (!playerId) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Bad route</h1>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Loading…</h1>
      </main>
    );
  }

  if (error || !player) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Error</h1>
        <pre className="mt-4 text-sm">{JSON.stringify(error, null, 2)}</pre>
      </main>
    );
  }

  const totalPoints = stats.reduce((sum, s) => sum + (s.points ?? 0), 0);
  const gamesPlayed = stats.length;
  const ppg = gamesPlayed > 0 ? (totalPoints / gamesPlayed).toFixed(1) : "0.0";

  // sort by tipoff desc (unknown tipoff last)
  const rows = [...stats].sort((a, b) => {
    const da = gamesById[a.game_id]?.tipoff ? new Date(gamesById[a.game_id].tipoff!).getTime() : -Infinity;
    const db = gamesById[b.game_id]?.tipoff ? new Date(gamesById[b.game_id].tipoff!).getTime() : -Infinity;
    return db - da;
  });

  return (
    <main className="p-8">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">
            {player.first_name} {player.last_name}
          </h1>
          <div className="text-gray-600 mt-1">
            #{player.jersey_number ?? "-"} •{" "}
            <Link href={`/teams/${player.team_id}`} className="hover:underline">
              {team?.team_name ?? player.team_id}
            </Link>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-600">Games</div>
          <div className="text-2xl font-bold">{gamesPlayed}</div>
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-600">Total PTS</div>
          <div className="text-2xl font-bold">{totalPoints}</div>
        </div>

        <div className="text-right">
          <div className="text-sm text-gray-600">PPG</div>
          <div className="text-2xl font-bold">{ppg}</div>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mt-8 mb-4">Game log</h2>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Match</th>
              <th className="p-3 w-24 text-right">PTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const g = gamesById[s.game_id];
              const dateText = g?.tipoff ? new Date(g.tipoff).toLocaleString() : "TBD";
              const matchText = g
                ? `${g.home_team_id} vs ${g.away_team_id}`
                : s.game_id;

              return (
                <tr key={s.game_id} className="border-t">
                  <td className="p-3">{dateText}</td>
                  <td className="p-3">
                    <Link href={`/games/${s.game_id}`} className="hover:underline">
                      {matchText}
                    </Link>
                  </td>
                  <td className="p-3 text-right font-semibold">{s.points ?? 0}</td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr className="border-t">
                <td className="p-3" colSpan={3}>
                  No games found for this player.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
