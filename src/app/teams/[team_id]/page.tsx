"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

// ... [Types remain the same as your snippet] ...
type Team = { team_id: string; team_name: string; city: string | null; coach: string | null; };
type Player = { player_id: string; first_name: string; last_name: string; jersey_number: number | null; };
type Game = { game_id: string; season: string | null; tipoff: string | null; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null; };
type Summary = { gamesPlayed: number; wins: number; losses: number; pf: number; pa: number; diff: number; };
type TeamMap = Record<string, string>;

export default function TeamPage() {
  const params = useParams();

  const teamId = useMemo(() => {
    const raw = (params as any)?.team_id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  const [team, setTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [teamsById, setTeamsById] = useState<TeamMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!teamId) return;
      setLoading(true);
      setError(null);

      const { data: allTeams } = await supabase.from("teams").select("team_id, team_name");
      if (cancelled) return;
      const map: TeamMap = {};
      (allTeams ?? []).forEach((t: any) => (map[t.team_id] = t.team_name));
      setTeamsById(map);

      const { data: teamData, error: teamError } = await supabase.from("teams").select("*").eq("team_id", teamId).maybeSingle();
      if (cancelled) return;
      if (teamError) { setError(teamError); setLoading(false); return; }
      if (!teamData) { setTeam(null); setLoading(false); return; }
      setTeam(teamData as Team);

      const [rosterRes, gamesRes] = await Promise.all([
        supabase.from("players").select("*").eq("team_id", teamId).order("last_name"),
        supabase.from("games").select("*").or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).order("tipoff", { ascending: false })
      ]);

      if (cancelled) return;
      setRoster((rosterRes.data ?? []) as Player[]);
      const allGames = (gamesRes.data ?? []) as Game[];
      setGames(allGames);

      const finished = allGames.filter(g => g.home_score != null && g.away_score != null);
      let wins = 0, losses = 0, pf = 0, pa = 0;
      for (const g of finished) {
        const isHome = g.home_team_id === teamId;
        const s = isHome ? (g.home_score ?? 0) : (g.away_score ?? 0);
        const c = isHome ? (g.away_score ?? 0) : (g.home_score ?? 0);
        pf += s; pa += c;
        if (s > c) wins += 1; else losses += 1;
      }
      setSummary({ gamesPlayed: finished.length, wins, losses, pf, pa, diff: pf - pa });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [teamId]);

  if (loading) return <div className="p-20 text-center font-black uppercase italic text-gray-400">Loading Franchise...</div>;
  if (!team) return <div className="p-20 text-center font-bold text-red-500">Team not found ({teamId})</div>;

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-12">
      {/* HEADER SECTION */}
      <header className="mb-12 border-b-4 border-black pb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
               <span className="bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Active</span>
               <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">ID: {team.team_id}</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none">
              {team.team_name}
            </h1>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-4">
              {team.city ?? "Regional"} • Coach {team.coach ?? "TBD"}
            </p>
          </div>

          {summary && (
            <div className="flex gap-2">
              <div className="bg-black text-white px-6 py-4 rounded-xl text-center min-w-[100px]">
                <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">Record</div>
                <div className="text-3xl font-black italic">{summary.wins}-{summary.losses}</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* STATS STRIP */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Games Played", val: summary.gamesPlayed },
            { label: "Points For", val: summary.pf },
            { label: "Points Against", val: summary.pa },
            { label: "Point Diff", val: summary.diff, color: summary.diff >= 0 ? 'text-green-600' : 'text-red-600' },
          ].map((stat, i) => (
            <div key={i} className="border-2 border-gray-100 p-4 rounded-xl">
              <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{stat.label}</div>
              <div className={`text-2xl font-black italic ${stat.color ?? 'text-black'}`}>{stat.val}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* RECENT GAMES */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400 mb-6 italic">Recent Schedule</h2>
          <div className="space-y-3">
            {games.slice(0, 8).map((g) => {
              const isWin = (g.home_team_id === teamId ? g.home_score! > g.away_score! : g.away_score! > g.home_score!);
              const isPlayed = g.home_score !== null;

              return (
                <Link key={g.game_id} href={`/games/${g.game_id}`} className="group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-black transition-all">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">
                      {g.tipoff ? new Date(g.tipoff).toLocaleDateString() : "TBD"}
                    </span>
                    <span className="font-black uppercase text-sm tracking-tight group-hover:text-orange-600">
                      {teamsById[g.home_team_id] ?? g.home_team_id} <span className="text-gray-300 mx-1">VS</span> {teamsById[g.away_team_id] ?? g.away_team_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {isPlayed && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isWin ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {isWin ? 'W' : 'L'}
                      </span>
                    )}
                    <span className="text-lg font-black italic tabular-nums">
                      {g.home_score ?? '--'} : {g.away_score ?? '--'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ROSTER */}
        <section>
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400 mb-6 italic">Active Roster</h2>
          <div className="bg-white border-2 border-black rounded-2xl overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,0.05)]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-black/5">
                  <th className="p-4 text-[10px] font-black uppercase text-gray-400 w-16">#</th>
                  <th className="p-4 text-[10px] font-black uppercase text-gray-400">Athlete</th>
                  <th className="p-4 text-[10px] font-black uppercase text-gray-400 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {roster.map((p) => (
                  <tr key={p.player_id} className="group hover:bg-orange-50/50 transition-colors">
                    <td className="p-4 text-sm font-black text-gray-300 italic group-hover:text-orange-600">{p.jersey_number ?? "--"}</td>
                    <td className="p-4">
                      <Link href={`/players/${p.player_id}`} className="text-sm font-black uppercase tracking-tight text-gray-900 group-hover:underline">
                        {p.first_name} {p.last_name}
                      </Link>
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/players/${p.player_id}`} className="text-[10px] font-black text-gray-400 uppercase group-hover:text-black">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
