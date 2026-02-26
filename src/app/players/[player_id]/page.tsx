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

      const { data: teamData } = await supabase
        .from("teams")
        .select("team_id, team_name")
        .eq("team_id", (playerData as Player).team_id)
        .maybeSingle();

      if (!cancelled) setTeam((teamData as Team) ?? null);

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
    return () => { cancelled = true; };
  }, [playerId]);

  if (!playerId) return <main className="p-8"><h1 className="text-2xl font-bold">Bad route</h1></main>;
  if (loading) return <main className="p-8 text-black"><h1 className="text-2xl font-black italic uppercase animate-pulse">Loading Stats...</h1></main>;
  if (error || !player) return (
    <main className="p-8 text-black">
      <h1 className="text-2xl font-bold">Error</h1>
      <pre className="mt-4 text-sm bg-red-50 p-4 rounded text-red-600 border border-red-100">{JSON.stringify(error, null, 2)}</pre>
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
    <main className="p-4 md:p-8 max-w-4xl mx-auto bg-gray-50 min-h-screen text-black">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b-4 border-black pb-6 mb-8 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-black uppercase italic tracking-tighter">
            {player.first_name} {player.last_name}
          </h1>
          <div className="flex items-center gap-3 mt-4 text-lg">
            <span className="bg-orange-600 text-white px-3 py-1 rounded-lg font-black italic">#{player.jersey_number ?? "?"}</span>
            <Link href={`/teams/${player.team_id}`} className="text-black/60 hover:text-orange-600 font-black uppercase tracking-tight underline decoration-orange-600 decoration-2 underline-offset-4 transition-colors">
              {team?.team_name ?? player.team_id}
            </Link>
          </div>
        </div>

        {/* Quick Stats Cards - Fixed Visibility */}
        <div className="flex gap-4">
          <div className="flex-1 md:flex-none bg-white p-4 rounded-xl border-2 border-black text-center min-w-[85px] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            <div className="text-[10px] uppercase text-gray-400 font-black mb-1">GP</div>
            <div className="text-2xl font-black text-black">{gamesPlayed}</div>
          </div>
          <div className="flex-1 md:flex-none bg-white p-4 rounded-xl border-2 border-black text-center min-w-[85px] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            <div className="text-[10px] uppercase text-gray-400 font-black mb-1">Total PTS</div>
            <div className="text-2xl font-black text-black">{totalPoints}</div>
          </div>
          <div className="flex-1 md:flex-none bg-orange-600 p-4 rounded-xl border-2 border-black text-center min-w-[85px] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            <div className="text-[10px] uppercase text-orange-200 font-black mb-1">PPG</div>
            <div className="text-2xl font-black text-white italic">{ppg}</div>
          </div>
        </div>
      </div>

      <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.4em] mb-4 px-1 italic">Season Game Log</h2>

      {/* GAME LOG LIST */}
      <div className="space-y-3">
        {rows.map((s) => {
          const g = gamesById[s.game_id];
          if (!g) return null;

          const isHome = g.home_team_id === player.team_id;
          const opponent = isHome ? g.away_team_id : g.home_team_id;
          
          let resultChar = "—";
          let resultColor = "text-gray-300";
          if (g.home_score !== null && g.away_score !== null) {
            const playerTeamScore = isHome ? g.home_score : g.away_score;
            const opponentScore = isHome ? g.away_score : g.home_score;
            if (playerTeamScore > opponentScore) { resultChar = "W"; resultColor = "text-green-600"; }
            else if (playerTeamScore < opponentScore) { resultChar = "L"; resultColor = "text-red-600"; }
            else { resultChar = "T"; resultColor = "text-gray-500"; }
          }

          const dateObj = g.tipoff ? new Date(g.tipoff) : null;
          const formattedDate = dateObj ? dateObj.toLocaleDateString('ro-MD', { month: 'short', day: 'numeric' }) : "TBD";

          return (
            /* CLICKABLE WRAPPER: Now links to the specific Game Page */
            <Link 
              key={s.game_id} 
              href={`/games/${s.game_id}`} 
              className="group bg-white border-2 border-black rounded-xl p-4 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] hover:bg-orange-50 hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
            >
              <div className="flex items-center gap-4">
                {/* Date & Result */}
                <div className="text-center min-w-[45px]">
                  <div className="text-[10px] font-black text-gray-300 uppercase leading-none mb-1">{formattedDate}</div>
                  <div className={`text-xl font-black ${resultColor} leading-none italic`}>{resultChar}</div>
                </div>
                
                {/* Opponent & Match Score */}
                <div className="border-l-2 border-gray-100 pl-4">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-tight mb-1">
                    {isHome ? "vs" : "@"} <span className="text-black group-hover:text-orange-600 transition-colors">{opponent}</span>
                  </div>
                  <div className="text-xs font-black text-gray-600 italic tabular-nums">{g.home_score} : {g.away_score}</div>
                </div>
              </div>

              {/* Individual Player Points */}
              <div className="text-right">
                <div className="text-[10px] font-black text-orange-400 uppercase leading-none mb-1">PTS</div>
                <div className="text-2xl font-black text-black italic leading-none">{s.points ?? 0}</div>
              </div>
            </Link>
          );
        })}

        {rows.length === 0 && (
          <div className="text-center py-10 bg-white rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-xs font-black uppercase italic tracking-widest">
            No game data available
          </div>
        )}
      </div>
    </main>
  );
}