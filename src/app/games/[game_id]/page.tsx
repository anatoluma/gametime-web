"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

// ... Types remain exactly as you had them ...
type Game = { game_id: string; season: string | null; tipoff: string | null; venue: string | null; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null; };
type Team = { team_id: string; team_name: string; };
type PlayerStat = { player_id: string; team_id: string; points: number | null; first_name: string | null; last_name: string | null; jersey_number: number | null; };
type DataIssue = { level: "warn" | "error"; message: string; };

export default function GamePage() {
  const params = useParams();
  const gameId = useMemo(() => {
    const raw = (params as any)?.game_id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [issues, setIssues] = useState<DataIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!gameId) return;
      setLoading(true);
      setError(null);
      setIssues([]);

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("game_id", gameId)
        .maybeSingle();

      if (cancelled) return;
      if (gameError || !gameData) {
        setError(gameError ?? { message: "Game not found" });
        setLoading(false);
        return;
      }
      setGame(gameData as Game);

      const { data: teamsData } = await supabase.from("teams").select("team_id, team_name");
      const teamMap: Record<string, Team> = {};
      (teamsData ?? []).forEach((t: Team) => { teamMap[t.team_id] = t; });
      setTeams(teamMap);

      const { data: statsData, error: statsError } = await supabase
        .from("player_game_stats")
        .select(`player_id, team_id, points, players (first_name, last_name, jersey_number)`)
        .eq("game_id", gameId);

      if (cancelled) return;
      if (statsError) { setError(statsError); setLoading(false); return; }

      const normalized: PlayerStat[] = (statsData ?? []).map((s: any) => ({
        player_id: s.player_id,
        team_id: s.team_id,
        points: s.points,
        first_name: s.players?.first_name ?? null,
        last_name: s.players?.last_name ?? null,
        jersey_number: s.players?.jersey_number ?? null,
      }));

      // --- Integrity Checks ---
      const newIssues: DataIssue[] = [];
      const homeId = (gameData as Game).home_team_id;
      const awayId = (gameData as Game).away_team_id;

      const badTeamRows = normalized.filter((r) => r.team_id !== homeId && r.team_id !== awayId);
      if (badTeamRows.length > 0) newIssues.push({ level: "error", message: `Incorrect team_id found in stats.` });

      const counts = new Map<string, number>();
      for (const r of normalized) { counts.set(r.player_id, (counts.get(r.player_id) ?? 0) + 1); }
      const dupes = Array.from(counts.entries()).filter(([, c]) => c > 1);
      if (dupes.length > 0) newIssues.push({ level: "error", message: `Duplicate player entries detected.` });

      const sumPts = (teamId: string) => normalized.filter((r) => r.team_id === teamId).reduce((s, r) => s + (r.points ?? 0), 0);
      const homeBox = sumPts(homeId);
      const awayBox = sumPts(awayId);
      const homeFinal = (gameData as Game).home_score;
      const awayFinal = (gameData as Game).away_score;

      if (homeFinal != null && awayFinal != null) {
        if (homeBox !== homeFinal) newIssues.push({ level: "warn", message: `Home score mismatch (Box: ${homeBox} vs Final: ${homeFinal})` });
        if (awayBox !== awayFinal) newIssues.push({ level: "warn", message: `Away score mismatch (Box: ${awayBox} vs Final: ${awayFinal})` });
      }

      setIssues(newIssues);
      setStats(normalized);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [gameId]);

  if (loading) return <main className="p-8 text-center font-black uppercase italic text-gray-400">Loading Game...</main>;
  if (error || !game) return <main className="p-8 text-center text-red-500 font-bold">Game not found</main>;

  const homeTeam = teams[game.home_team_id];
  const awayTeam = teams[game.away_team_id];
  const homeStats = stats.filter((s) => s.team_id === game.home_team_id);
  const awayStats = stats.filter((s) => s.team_id === game.away_team_id);

  const renderTable = (rows: PlayerStat[]) => (
    <div className="bg-white border-2 border-gray-900 rounded-xl overflow-hidden shadow-sm mt-3">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-200">
            <th className="py-2 px-3 text-[10px] font-black uppercase text-gray-400 w-12">#</th>
            <th className="py-2 px-3 text-[10px] font-black uppercase text-gray-400">Player</th>
            <th className="py-2 px-3 text-[10px] font-black uppercase text-gray-400 text-right">PTS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.sort((a,b) => (b.points ?? 0) - (a.points ?? 0)).map((p) => (
            <tr key={p.player_id} className="hover:bg-gray-50 transition-colors">
              <td className="py-2 px-3 text-xs font-bold text-gray-400 italic">{p.jersey_number ?? "-"}</td>
              <td className="py-2 px-3">
                <Link href={`/players/${p.player_id}`} className="text-sm font-black uppercase tracking-tighter hover:text-orange-600">
                  {p.first_name} {p.last_name}
                </Link>
              </td>
              <td className="py-2 px-3 text-right text-sm font-black text-gray-900 bg-gray-50/50">{p.points ?? 0}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} className="p-4 text-xs text-center text-gray-400 italic uppercase">No stats recorded</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      {/* SCOREBOARD HERO */}
      <div className="bg-gray-900 text-white rounded-2xl p-6 md:p-10 shadow-2xl relative overflow-hidden border-b-4 border-orange-600">
        {/* Decorative Background Text */}
        <div className="absolute top-0 right-0 text-8xl font-black italic text-white/5 select-none pointer-events-none transform translate-x-1/4 -translate-y-1/4">
          GAMEDAY
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          {/* Home Team */}
          <div className="text-center md:text-right flex-1 order-2 md:order-1">
            <Link href={`/teams/${game.home_team_id}`} className="text-xl md:text-3xl font-black uppercase italic tracking-tighter hover:text-orange-400 transition-colors">
              {homeTeam?.team_name ?? "Home Team"}
            </Link>
            <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mt-1">Home</p>
          </div>

          {/* Score/Center */}
          <div className="text-center order-1 md:order-2">
             <div className="flex items-center justify-center gap-4 md:gap-8">
                <span className="text-5xl md:text-7xl font-black italic tabular-nums">{game.home_score ?? "-"}</span>
                <span className="text-xl md:text-2xl font-black text-orange-500">:</span>
                <span className="text-5xl md:text-7xl font-black italic tabular-nums">{game.away_score ?? "-"}</span>
             </div>
             <div className="mt-4 inline-block bg-orange-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
               {game.home_score !== null ? 'Final Score' : 'Scheduled'}
             </div>
          </div>

          {/* Away Team */}
          <div className="text-center md:text-left flex-1 order-3">
            <Link href={`/teams/${game.away_team_id}`} className="text-xl md:text-3xl font-black uppercase italic tracking-tighter hover:text-orange-400 transition-colors">
              {awayTeam?.team_name ?? "Away Team"}
            </Link>
            <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mt-1">Away</p>
          </div>
        </div>

        {/* Game Details */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
           <span>{game.tipoff ? new Date(game.tipoff).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' }) : "Date TBD"}</span>
           <span className="hidden md:inline">•</span>
           <span>{game.venue ?? "Venue TBD"}</span>
           <span className="hidden md:inline">•</span>
           <span className="text-orange-500">{game.season ?? "2025/26 Season"}</span>
        </div>
      </div>

      {/* ISSUES ALERT BOX */}
      {issues.length > 0 && (
        <div className="mt-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h3 className="text-[10px] font-black uppercase text-amber-800 tracking-widest">System Integrity Alert</h3>
            <ul className="mt-1 space-y-1">
              {issues.map((i, idx) => (
                <li key={idx} className="text-[11px] font-bold text-amber-700 leading-tight">• {i.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* BOX SCORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <div>
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Home Box Score</h2>
            <span className="text-[10px] font-bold text-gray-400 italic">Sorted by Points</span>
          </div>
          {renderTable(homeStats)}
        </div>

        <div>
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Away Box Score</h2>
            <span className="text-[10px] font-bold text-gray-400 italic">Sorted by Points</span>
          </div>
          {renderTable(awayStats)}
        </div>
      </div>
    </main>
  );
}
