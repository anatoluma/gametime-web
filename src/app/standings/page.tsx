import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type TeamRow = {
  team_id: string;
  name: string;
  gp: number;
  w: number;
  l: number;
  pts: number;
  pf: number; 
  pa: number; 
  diff: number;
};

export default async function StandingsPage() {
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("home_team_id, away_team_id, home_score, away_score")
    .not("home_score", "is", null)
    .not("away_score", "is", null);

  if (gamesError) return <pre className="p-6">{JSON.stringify(gamesError, null, 2)}</pre>;

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("team_id, team_name")
    .eq("is_active", true)
    .order("team_name");

  if (teamsError) return <pre className="p-6">{JSON.stringify(teamsError, null, 2)}</pre>;

  const table: Record<string, TeamRow> = {};

  for (const t of teams ?? []) {
    table[t.team_id] = {
      team_id: t.team_id,
      name: t.team_name,
      gp: 0, w: 0, l: 0, pts: 0, pf: 0, pa: 0, diff: 0,
    };
  }

  for (const g of games ?? []) {
    const hs = Number(g.home_score);
    const as = Number(g.away_score);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;

    const home = table[g.home_team_id];
    const away = table[g.away_team_id];
    if (!home || !away) continue;

    home.gp += 1;
    away.gp += 1;
    home.pf += hs;
    home.pa += as;
    away.pf += as;
    away.pa += hs;

    if (hs > as) {
      home.w += 1; away.l += 1;
      home.pts += 2; away.pts += 1;
    } else if (as > hs) {
      away.w += 1; home.l += 1;
      away.pts += 2; home.pts += 1;
    } else {
      home.pts += 1; away.pts += 1;
    }
  }

  for (const k of Object.keys(table)) {
    table[k].diff = table[k].pf - table[k].pa;
  }

  const sorted = Object.values(table).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.pf !== a.pf) return b.pf - a.pf;
    return a.name.localeCompare(b.name);
  });

 /* ... existing imports and logic stay the same ... */

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter text-gray-900 uppercase">Standings</h1>
          <div className="h-1.5 w-24 bg-orange-600 mt-1"></div>
        </div>
        <Link href="/games" className="hidden sm:block bg-gray-900 text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg">
          Full Schedule
        </Link>
      </div>

      <div className="bg-white border-2 border-gray-900 rounded-xl shadow-2xl overflow-hidden">
        {/* The horizontal scroll container */}
        <div className="overflow-x-auto lg:overflow-x-visible">
          <table className="w-full text-left border-collapse min-w-[500px] lg:min-w-full">
            <thead>
              <tr className="bg-gray-900 border-b-2 border-gray-900">
                {/* Fixed narrow rank column */}
                <th className="py-4 px-2 sticky left-0 bg-gray-900 z-20 !text-white text-[10px] font-black uppercase tracking-widest w-10 text-center">#</th>
                
                {/* Fixed team column - set width smaller on mobile */}
                <th className="py-4 px-3 sticky left-10 bg-gray-900 z-20 min-w-[120px] md:min-w-[160px] !text-white text-[10px] font-black uppercase tracking-widest border-r border-gray-800 lg:border-r-0">Team</th>
                
                {/* Stat columns - no z-index so they slide UNDER */}
                <th className="py-4 px-3 text-center !text-white text-[10px] font-black tracking-widest">GP</th>
                <th className="py-4 px-3 text-center !text-white text-[10px] font-black tracking-widest">W</th>
                <th className="py-4 px-3 text-center !text-white text-[10px] font-black tracking-widest">L</th>
                <th className="py-4 px-3 text-center !text-orange-400 text-[10px] font-black tracking-widest bg-gray-800">PTS</th>
                <th className="py-4 px-3 text-center !text-white text-[10px] font-black tracking-widest">PF</th>
                <th className="py-4 px-3 text-center !text-white text-[10px] font-black tracking-widest">PA</th>
                <th className="py-4 px-3 text-center !text-white text-[10px] font-black tracking-widest pr-6">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((t, idx) => (
                <tr key={t.team_id} className="hover:bg-orange-50/50 transition-colors group">
                  <td className="py-4 px-2 text-xs font-black text-gray-400 sticky left-0 bg-white group-hover:bg-orange-50/50 z-10 transition-colors w-10 text-center">
                    {idx + 1}
                  </td>
                  <td className="py-4 px-3 font-black text-gray-900 sticky left-10 bg-white group-hover:bg-orange-50/50 z-10 transition-colors border-r border-gray-50 lg:border-r-0">
                    <Link href={`/teams/${t.team_id}`} className="hover:text-orange-600 transition-colors uppercase tracking-tighter text-[11px] md:text-sm whitespace-nowrap">
                      {t.name}
                    </Link>
                  </td>
                  <td className="py-4 px-3 text-center text-xs font-bold text-gray-600">{t.gp}</td>
                  <td className="py-4 px-3 text-center text-xs font-bold text-green-600">{t.w}</td>
                  <td className="py-4 px-3 text-center text-xs font-bold text-red-400">{t.l}</td>
                  <td className="py-4 px-3 text-center font-black text-gray-900 bg-gray-50/80 group-hover:bg-orange-100/50">{t.pts}</td>
                  <td className="py-4 px-3 text-center text-xs text-gray-500">{t.pf}</td>
                  <td className="py-4 px-3 text-center text-xs text-gray-500">{t.pa}</td>
                  <td className={`py-4 px-3 text-center text-xs font-black pr-6 ${t.diff >= 0 ? 'text-blue-600' : 'text-orange-700'}`}>
                    {t.diff > 0 ? `+${t.diff}` : t.diff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* ... footer system remains the same ... */}
    </main>
  );
}