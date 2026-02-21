"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

// ... Types remain exactly the same ...
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

      const newIssues: DataIssue[] = [];
      const homeId = (gameData as Game).home_team_id;
      const awayId = (gameData as Game).away_team_id;

      const badTeamRows = normalized.filter((r) => r.team_id !== homeId && r.team_id !== awayId);
      if (badTeamRows.length > 0) newIssues.push({ level: "error", message: `Incorrect team_id found in stats.` });

      const sumPts = (teamId: string) => normalized.filter((r) => r.team_id === teamId).reduce((s, r) => s + (r.points ?? 0), 0);
      const homeBox = sumPts(homeId);
      const awayBox = sumPts(awayId);
      
      if (gameData.home_score != null && gameData.away_score != null) {
        if (homeBox !== gameData.home_score) newIssues.push({ level: "warn", message: `Home mismatch (Box: ${homeBox} vs Final: ${gameData.home_score})` });
        if (awayBox !== gameData.away_score) newIssues.push({ level: "warn", message: `Away mismatch (Box: ${awayBox} vs Final: ${gameData.away_score})` });
      }

      setIssues(newIssues);
      setStats(normalized);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [gameId]);

  if (loading) return <main className="p-8 text-center font-black uppercase italic text-gray-500">Loading Game...</main>;
  if (error || !game) return <main className="p-8 text-center text-red-500 font-bold uppercase">Game not found</main>;

  const homeTeam = teams[game.home_team_id];
  const awayTeam = teams[game.away_team_id];
  const homeStats = stats.filter((s) => s.team_id === game.home_team_id);
  const awayStats = stats.filter((s) => s.team_id === game.away_team_id);

  // UPDATED: High Contrast Table
  const renderTable = (rows: PlayerStat[]) => (
    <div className="bg-white border-4 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] mt-3">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-black text-white">
            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-orange-500 w-12">#</th>
            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-orange-500">Player</th>
            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-orange-500 text-right">PTS</th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-gray-100">
          {rows.sort((a,b) => (b.points ?? 0) - (a.points ?? 0)).map((p) => (
            <tr key={p.player_id} className="hover:bg-orange-50 transition-colors group">
              <td className="py-3 px-4 text-xs font-black text-gray-400 italic group-hover:text-black">{p.jersey_number ?? "-"}</td>
              <td className="py-3 px-4">
                <Link href={`/players/${p.player_id}`} className="text-sm font-black uppercase tracking-tighter text-black group-hover:text-orange-600 block">
                  {p.first_name} {p.last_name}
                </Link>
              </td>
              <td className="py-3 px-4 text-right text-base font-black text-black tabular-nums italic">
                {p.points ?? 0}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="p-10 text-xs text-center text-gray-400 font-black uppercase italic tracking-widest">No Stats Recorded</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto bg-white min-h-screen border-x border-gray-100">
      {/* SCOREBOARD HERO */}
      <div className="bg-black text-white rounded-3xl p-6 md:p-12 shadow-2xl relative overflow-hidden border-b-8 border-orange-600">
        <div className="absolute top-0 right-0 text-9xl font-black italic text-white/5 select-none pointer-events-none transform translate-x-1/4 -translate-y-1/4">
          GAME
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
          <div className="text-center md:text-right flex-1">
            <Link href={`/teams/${game.home_team_id}`} className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter text-white hover:text-orange-500 transition-colors block leading-none">
              {homeTeam?.team_name ?? "Home Team"}
            </Link>
            <p className="text-[10px] font-black text-orange-500 tracking-[0.3em] uppercase mt-2">Home Franchise</p>
          </div>

          <div className="text-center flex flex-col items-center">
             <div className="flex items-center justify-center gap-6">
                <span className="text-6xl md:text-8xl font-black italic tabular-nums text-white leading-none">{game.home_score ?? "-"}</span>
                <span className="text-2xl md:text-4xl font-black text-orange-600">:</span>
                <span className="text-6xl md:text-8xl font-black italic tabular-nums text-white leading-none">{game.away_score ?? "-"}</span>
             </div>
             <div className="mt-6 bg-orange-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em]">
                {game.home_score !== null ? 'Final Results' : 'Scheduled'}
             </div>
          </div>

          <div className="text-center md:text-left flex-1">
            <Link href={`/teams/${game.away_team_id}`} className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter text-white hover:text-orange-500 transition-colors block leading-none">
              {awayTeam?.team_name ?? "Away Team"}
            </Link>
            <p className="text-[10px] font-black text-orange-500 tracking-[0.3em] uppercase mt-2">Away Franchise</p>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/10 flex flex-wrap justify-center gap-x-10 gap-y-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
           <span className="flex items-center gap-2"><span className="text-orange-600">●</span> {game.tipoff ? new Date(game.tipoff).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) : "TBD"}</span>
           <span className="flex items-center gap-2"><span className="text-orange-600">●</span> {game.venue ?? "Local Arena"}</span>
           <span className="flex items-center gap-2 text-white">{game.season ?? "2025/26 Season"}</span>
        </div>
      </div>

      {/* ISSUES ALERT BOX */}
      {issues.length > 0 && (
        <div className="mt-8 bg-red-50 border-l-8 border-red-600 p-6 shadow-sm">
            <h3 className="text-[12px] font-black uppercase text-red-600 tracking-widest mb-2">Data Integrity Alert</h3>
            <ul className="space-y-1">
              {issues.map((i, idx) => (
                <li key={idx} className="text-xs font-black text-gray-900">• {i.message}</li>
              ))}
            </ul>
        </div>
      )}

      {/* BOX SCORES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-black">Home Box Score</h2>
            <div className="h-1 flex-1 bg-black"></div>
          </div>
          {renderTable(homeStats)}
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-black">Away Box Score</h2>
            <div className="h-1 flex-1 bg-black"></div>
          </div>
          {renderTable(awayStats)}
        </section>
      </div>
    </main>
  );
}
