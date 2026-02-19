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
      // Note: If you get an error here, check if your table is named 'playerstats' or 'player_game_stats'
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

  if (!playerId) return <main className="p-8"><h1 className="text-2xl font-bold">Bad route</h1></main>;
  if (loading) return <main className="p-8"><h1 className="text-2xl font-bold">Loading Stats...</h1></main>;
  if (error || !player) return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Error</h1>
      <pre className="mt-4 text-sm bg-red-50 p-4 rounded">{JSON.stringify(error, null, 2)}</pre>
    </main>
  );

  const totalPoints = stats.reduce((sum, s) => sum + (s.points ?? 0), 0);
  const gamesPlayed = stats.length;
  const ppg = gamesPlayed > 0 ? (totalPoints / gamesPlayed).toFixed(1) : "0.0";

  const rows = [...stats].sort((a, b) => {
    const da = gamesById[a.game_id]?.tipoff ? new Date(gamesById[a.game_id].tipoff!).getTime() : -Infinity;
    const db = gamesById[b.game_id]?.tipoff ? new Date(gamesById[b.game_id].tipoff!).getTime() : -Infinity;
    return db - da;
  });

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b pb-6 mb-8 gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tight">
            {player.first_name} {player.last_name}
          </h1>
          <div className="flex items-center gap-2 mt-2 text-lg">
            <span className="bg-orange-600 text-white px-2 py-0.5 rounded font-bold">#{player.jersey_number ?? "?"}</span>
            <Link href={`/teams/${player.team_id}`} className="text-gray-600 hover:text-orange-600 font-medium underline decoration-orange-200 underline-offset-4">
              {team?.team_name ?? player.team_id}
            </Link>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="flex gap-4">
          <div className="bg-gray-50 p-4 rounded-xl border text-center min-w-[80px]">
            <div className="text-xs uppercase text-gray-500 font-bold mb-1">GP</div>
            <div className="text-2xl font-black">{gamesPlayed}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border text-center min-w-[80px]">
            <div className="text-xs uppercase text-gray-500 font-bold mb-1">Total PTS</div>
            <div className="text-2xl font-black">{totalPoints}</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 text-center min-w-[80px]">
            <div className="text-xs uppercase text-orange-600 font-bold mb-1">PPG</div>
            <div className="text-2xl font-black text-orange-700">{ppg}</div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Season Game Log</h2>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Date</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Opponent</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Result</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500 text-right">PTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const g = gamesById[s.game_id];
              if (!g) return null;

              const isHome = g.home_team_id === player.team_id;
              const opponent = isHome ? g.away_team_id : g.home_team_id;
              
              // Determine Win/Loss
              let resultChar = "";
              let resultColor = "text-gray-400";
              if (g.home_score !== null && g.away_score !== null) {
                const playerTeamScore = isHome ? g.home_score : g.away_score;
                const opponentScore = isHome ? g.away_score : g.home_score;
                if (playerTeamScore > opponentScore) {
                  resultChar = "W";
                  resultColor = "text-green-600";
                } else if (playerTeamScore < opponentScore) {
                  resultChar = "L";
                  resultColor = "text-red-600";
                } else {
                  resultChar = "T";
                }
              }

              const dateObj = g.tipoff ? new Date(g.tipoff) : null;
              const formattedDate = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "TBD";

              return (
                <tr key={s.game_id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-600 font-medium">{formattedDate}</td>
                  <td className="p-4 font-semibold text-gray-900">
                    <span className="text-gray-400 mr-2 font-normal">{isHome ? "vs" : "@"}</span>
                    <Link href={`/teams/${opponent}`} className="hover:text-orange-600">
                      {opponent}
                    </Link>
                  </td>
                  <td className="p-4">
                    <span className={`font-black mr-2 ${resultColor}`}>{resultChar}</span>
                    <span className="text-gray-600">{g.home_score}-{g.away_score}</span>
                  </td>
                  <td className="p-4 text-right font-black text-lg text-gray-900">{s.points ?? 0}</td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td className="p-8 text-center text-gray-400" colSpan={4}>
                  No game data available for this player.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}