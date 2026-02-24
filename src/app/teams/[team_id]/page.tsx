"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

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

  if (loading) return <div className="p-20 text-center font-black uppercase italic text-gray-500 animate-pulse">Loading Franchise Data...</div>;
  if (!team) return <div className="p-20 text-center font-bold text-red-600 uppercase tracking-widest">Team not found ({teamId})</div>;

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-12 bg-white min-h-screen text-black">
      {/* HEADER SECTION */}
      <header className="mb-12 border-b-8 border-black pb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-3">
               <span className="bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-[0.2em]">Active Franchise</span>
               <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">UID: {team.team_id}</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85] text-black">
              {team.team_name}
            </h1>
            <p className="text-sm font-black text-gray-500 uppercase tracking-[0.3em] mt-6">
              {team.city ?? "Regional"} <span className="text-orange-600 mx-2">•</span> Head Coach {team.coach ?? "TBD"}
            </p>
          </div>

          {summary && (
            <div className="bg-black text-white p-6 rounded-2xl text-center min-w-[140px] shadow-xl rotate-1">
              <div className="text-[10px] font-black uppercase text-orange-500 tracking-widest mb-1">Win/Loss</div>
              <div className="text-4xl font-black italic tracking-tighter">{summary.wins}-{summary.losses}</div>
            </div>
          )}
        </div>
      </header>

      {/* STATS STRIP */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            { label: "Games Played", val: summary.gamesPlayed },
            { label: "Points For", val: summary.pf },
            { label: "Points Against", val: summary.pa },
            { label: "Point Diff", val: summary.diff, color: summary.diff >= 0 ? 'text-green-600' : 'text-red-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-gray-50 border-2 border-gray-100 p-5 rounded-2xl">
              <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">{stat.label}</div>
              <div className={`text-3xl font-black italic tracking-tight ${stat.color ?? 'text-black'}`}>{stat.val}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* RECENT GAMES */}
        <section>
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-black italic">Recent Schedule</h2>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>
          <div className="space-y-4">
            {games.slice(0, 8).map((g) => {
              const isWin = (g.home_team_id === teamId ? g.home_score! > g.away_score! : g.away_score! > g.home_score!);
              const isPlayed = g.home_score !== null;

              return (
                <Link key={g.game_id} href={`/games/${g.game_id}`} className="group flex items-center justify-between p-4 md:p-5 border-2 border-gray-100 rounded-2xl hover:border-black hover:bg-gray-50 transition-all">
                  {/* Left Column: Team Names */}
                  <div className="flex flex-col flex-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      {g.tipoff ? new Date(g.tipoff).toLocaleDateString() : "TBD"}
                    </span>
                    {/* Responsive Stack: Rows on Mobile, Line on Desktop */}
                    <div className="flex flex-col md:flex-row md:items-center font-black uppercase text-[11px] md:text-sm tracking-tight text-black group-hover:text-orange-600">
                      <span>{teamsById[g.home_team_id] ?? g.home_team_id}</span>
                      <span className="text-gray-300 md:mx-2 text-[9px] md:text-xs">VS</span>
                      <span>{teamsById[g.away_team_id] ?? g.away_team_id}</span>
                    </div>
                  </div>

                  {/* Middle Column: W/L Indicator */}
                  <div className="flex items-center justify-center w-12">
                    {isPlayed && (
                      <span className={`text-[10px] font-black px-2 py-1 rounded-md min-w-[24px] text-center ${isWin ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                        {isWin ? 'W' : 'L'}
                      </span>
                    )}
                  </div>

                  {/* Right Column: Score */}
                  <div className="text-right min-w-[70px]">
                    <span className="text-lg md:text-xl font-black italic tabular-nums text-black whitespace-nowrap">
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
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-black italic">Active Roster</h2>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>
          <div className="bg-white border-4 border-black rounded-3xl overflow-hidden shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-black">
                  <th className="p-5 text-[10px] font-black uppercase text-orange-500 tracking-widest w-20">#</th>
                  <th className="p-5 text-[10px] font-black uppercase text-orange-500 tracking-widest">Athlete</th>
                  <th className="p-5 text-[10px] font-black uppercase text-orange-500 tracking-widest text-right">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roster.map((p) => (
                  <tr key={p.player_id} className="group hover:bg-orange-50 transition-colors">
                    <td className="p-5 text-sm font-black text-gray-400 italic group-hover:text-orange-600">{p.jersey_number ?? "--"}</td>
                    <td className="p-5">
                      <Link href={`/players/${p.player_id}`} className="text-sm font-black uppercase tracking-tight text-black group-hover:text-orange-600">
                        {p.first_name} {p.last_name}
                      </Link>
                    </td>
                    <td className="p-5 text-right">
                      {/* Fixed "Profile" Button Visibility: Switched to bg-gray-200 for high contrast */}
                      <Link href={`/players/${p.player_id}`} className="inline-block text-[10px] font-black bg-gray-200 text-black group-hover:bg-black group-hover:text-white px-3 py-1.5 rounded-full uppercase transition-all shadow-sm">
                        Profile
                      </Link>
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