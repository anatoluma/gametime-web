"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type GameRow = {
  game_id: string;
  season: string | null;
  tipoff: string | null;
  venue: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

type TeamRow = {
  team_id: string;
  team_name: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekendWindow(now: Date, offsetWeeks: 0 | -1) {
  const today = startOfDay(now);
  const day = today.getDay();
  const daysUntilSat = (6 - day + 7) % 7; 

  const upcomingSat = new Date(today);
  upcomingSat.setDate(upcomingSat.getDate() + daysUntilSat);

  const targetSat = new Date(upcomingSat);
  if (offsetWeeks === -1) targetSat.setDate(targetSat.getDate() - 7);

  const start = startOfDay(targetSat);
  const end = new Date(start);
  end.setDate(end.getDate() + 2); 

  return { start, end };
}

function inRange(iso: string | null, start: Date, end: Date) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export default function GamesPage() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [teamsById, setTeamsById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: teams } = await supabase.from("teams").select("team_id, team_name");
      if (cancelled) return;
      const map: Record<string, string> = {};
      (teams ?? []).forEach((t: TeamRow) => (map[t.team_id] = t.team_name));
      setTeamsById(map);

      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select("*")
        .order("tipoff", { ascending: false });

      if (cancelled) return;
      if (gamesError) { setError(gamesError); setLoading(false); return; }

      setGames((gamesData ?? []) as GameRow[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const computed = useMemo(() => {
    const now = new Date();
    
    // helper to get the Monday of a given week
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      return startOfDay(new Date(date.setDate(diff)));
    };

    const thisMonday = getMonday(now);
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const isFinished = (g: GameRow) => g.home_score != null && g.away_score != null;
    
    // 1. Current Week Games (Today + Future this week)
    const upcomingThisWeek = games.filter(g => 
      inRange(g.tipoff, thisMonday, nextMonday) && !isFinished(g)
    ).sort((a, b) => (a.tipoff ? new Date(a.tipoff).getTime() : 0) - (b.tipoff ? new Date(b.tipoff).getTime() : 0));

    // 2. Today's Finished Games or Recent Results
    const recentResults = games.filter(g => 
      (inRange(g.tipoff, thisMonday, nextMonday) || inRange(g.tipoff, lastMonday, thisMonday)) && isFinished(g)
    ).sort((a, b) => (b.tipoff ? new Date(b.tipoff).getTime() : 0) - (a.tipoff ? new Date(a.tipoff).getTime() : 0));

    const allUpcoming = games.filter(g => !isFinished(g));
    const allFinished = games.filter(isFinished);

    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return {
      upcomingThisWeek,
      recentResults,
      allUpcoming,
      allFinished,
      thisWeekLabel: `${fmt(thisMonday)} — ${fmt(new Date(nextMonday.getTime() - 86400000))}`,
      lastWeekLabel: `${fmt(lastMonday)} — ${fmt(new Date(thisMonday.getTime() - 86400000))}`,
    };
  }, [games]);

  const GameCard = ({ g }: { g: GameRow }) => {
    const isFinished = g.home_score != null && g.away_score != null;
    const dateObj = g.tipoff ? new Date(g.tipoff) : null;
    const timeText = dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "TBD";
    const dateText = dateObj ? dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : "";

    return (
      <Link href={`/games/${g.game_id}`} className="group block bg-white border rounded-xl shadow-sm hover:shadow-md hover:border-orange-500 transition-all overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b text-[10px] font-bold uppercase tracking-wider text-gray-500">
          <div className="flex items-center gap-1.5">
            <span>{dateText}</span>
            <span>•</span>
            <span className="text-gray-900">{timeText}</span>
          </div>
          <span className={isFinished ? "text-green-600" : "text-orange-600"}>
            {isFinished ? "● Final" : "○ Scheduled"}
          </span>
        </div>
        
        <div className="p-3 flex items-center justify-between gap-2">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-xs text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors mb-1">
              {g.home_team_id.substring(0, 3)}
            </div>
            <span className="text-[11px] font-bold text-gray-900 leading-tight h-8 flex items-center">{teamsById[g.home_team_id] || g.home_team_id}</span>
          </div>

          {/* Center Score/VS Area */}
          <div className="flex flex-col items-center min-w-[60px]">
            {isFinished ? (
              <div className="text-xl font-black text-gray-900 flex items-center gap-2">
                <span>{g.home_score}</span>
                <span className="text-gray-300 text-xs">-</span>
                <span>{g.away_score}</span>
              </div>
            ) : (
              <div className="px-2 py-0.5 bg-gray-100 rounded text-[9px] font-bold text-gray-500 uppercase tracking-widest">VS</div>
            )}
            <div className="text-[9px] text-gray-400 font-medium mt-1 truncate max-w-[80px] text-center">{g.venue || "TBD"}</div>
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-xs text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors mb-1">
              {g.away_team_id.substring(0, 3)}
            </div>
            <span className="text-[11px] font-bold text-gray-900 leading-tight h-8 flex items-center">{teamsById[g.away_team_id] || g.away_team_id}</span>
          </div>
        </div>
      </Link>
    );
  };

  if (loading) return <main className="p-8 max-w-2xl mx-auto font-bold text-2xl">Updating Schedule...</main>;

  return (
    <main className="p-4 max-w-2xl mx-auto bg-gray-50 min-h-screen pb-20">
      <div className="flex items-center justify-between mb-6 pt-4">
        <h1 className="text-3xl font-black italic tracking-tighter text-gray-900 uppercase">Schedule</h1>
        <div className="w-10 h-1 bg-orange-600"></div>
      </div>

      {/* Section: Upcoming */}
      <section className="mb-10">
        <div className="flex justify-between items-end mb-4 px-1">
          <div>
            <h2 className="text-sm font-black uppercase text-gray-900 tracking-tight">This Week's Games</h2>
            <p className="text-[10px] font-bold text-orange-600 uppercase">{computed.thisWeekLabel}</p>
          </div>
        </div>
        <div className="grid gap-3">
          {computed.upcomingThisWeek.map(g => <GameCard key={g.game_id} g={g} />)}
          {computed.upcomingThisWeek.length === 0 && (
            <p className="text-gray-400 text-xs italic p-4 bg-white rounded-lg border border-dashed text-center">No more games scheduled for this week.</p>
          )}
        </div>
        {/* ... Keep your "All Scheduled" details tag here ... */}
      </section>

      {/* Section: Recent Results */}
      <section>
        <div className="flex justify-between items-end mb-4 px-1">
          <div>
            <h2 className="text-sm font-black uppercase text-gray-900 tracking-tight">Recent Results</h2>
            <p className="text-[10px] font-bold text-gray-500 uppercase">Latest scores from this & last week</p>
          </div>
        </div>
        <div className="grid gap-3">
          {computed.recentResults.slice(0, 6).map(g => <GameCard key={g.game_id} g={g} />)}
        </div>
        {/* ... Keep your "All Past Results" details tag here ... */}
      </section>
    </main>
  );
}
