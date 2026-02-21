import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

export const revalidate = 0;

export const metadata = {
  title: 'Liga Basket Moldova | Stats & Scores',
  description: 'The official stats database for the Moldovan Basketball League.',
  metadataBase: new URL('https://ligabasket.md'),
}

export default async function Home() {
  const [teamsRes, gamesRes, leadersRes] = await Promise.all([
    supabase.from("teams").select("team_id, team_name").eq("is_active", true),
    supabase.from("games").select("*").order("tipoff", { ascending: false }),
    supabase.from("player_game_stats").select(`
      points,
      players (first_name, last_name, team_id)
    `).order("points", { ascending: false }).limit(5)
  ]);

  const teams = teamsRes.data ?? [];
  const allGames = gamesRes.data ?? [];
  const recentGames = allGames.slice(0, 4); // Just for the top strip
  const leaders = leadersRes.data ?? [];

  // --- STANDINGS LOGIC (Extracted from your StandingsPage) ---
  const table: Record<string, any> = {};
  teams.forEach(t => {
    table[t.team_id] = { name: t.team_name, w: 0, l: 0, pts: 0, diff: 0, pf: 0 };
  });

  allGames.forEach(g => {
    if (g.home_score !== null && g.away_score !== null) {
      const hs = Number(g.home_score);
      const as = Number(g.away_score);
      const home = table[g.home_team_id];
      const away = table[g.away_team_id];
      if (home && away) {
        home.pf += hs; away.pf += as;
        if (hs > as) { home.w += 1; away.l += 1; home.pts += 2; away.pts += 1; }
        else { away.w += 1; home.l += 1; away.pts += 2; home.pts += 1; }
        home.diff = home.pf - (home.pa || 0); // Simplified for home preview
      }
    }
  });

  const sortedStandings = Object.values(table)
    .sort((a: any, b: any) => b.pts - a.pts || b.diff - a.diff)
    .slice(0, 5); // Only show top 5 on Home Page

  return (
    <main className="min-h-screen bg-white text-black">
      {/* 1. HERO SECTION */}
      <section className="bg-black text-white py-10 md:py-16 px-6 border-b-[10px] border-orange-600 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <h1 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter leading-none mb-2">
            LIGA <span className="text-orange-600">BASKET</span>
          </h1>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.5em] text-gray-500">
            Official Data Hub • Chisinau, Moldova
          </p>
        </div>
      </section>

      {/* 2. COMPACT MATCH STRIP */}
      <section className="bg-gray-100 border-b-2 border-black">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {recentGames.map((game) => (
              <Link key={game.game_id} href={`/games/${game.game_id}`} className="bg-white border-2 border-black p-3 hover:bg-orange-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none">
                <div className="flex justify-between items-center mb-1 border-b border-gray-50 pb-1">
                  <span className="text-[8px] font-black uppercase text-orange-600 italic">{game.home_score !== null ? 'Final' : 'Upcoming'}</span>
                  <span className="text-[8px] font-bold text-gray-400">{new Date(game.tipoff).toLocaleDateString('ro-MD', {day: 'numeric', month: 'short'})}</span>
                </div>
                <div className="flex justify-between text-[11px] font-black uppercase"><span>{game.home_team_id}</span><span>{game.home_score ?? 0}</span></div>
                <div className="flex justify-between text-[11px] font-black uppercase"><span>{game.away_team_id}</span><span>{game.away_score ?? 0}</span></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. MAIN CONTENT GRID */}
      <div className="max-w-6xl mx-auto p-4 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* LEFT: MINI STANDINGS (Replaces Maintenance Section) */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-black uppercase italic">League Standings</h2>
            <Link href="/standings" className="text-[10px] font-bold border-b-2 border-black">Full Table →</Link>
          </div>
          <div className="border-2 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)]">
            <table className="w-full text-left bg-white">
              <thead className="bg-gray-900 text-white text-[9px] uppercase tracking-widest">
                <tr>
                  <th className="p-3">Team</th>
                  <th className="p-3 text-center">W-L</th>
                  <th className="p-3 text-center">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedStandings.map((team: any, i) => (
                  <tr key={i} className="hover:bg-orange-50 transition-colors">
                    <td className="p-3 font-black uppercase text-xs">
                      <span className="text-gray-300 mr-2"># {i+1}</span> {team.name}
                    </td>
                    <td className="p-3 text-center text-xs font-bold">{team.w}-{team.l}</td>
                    <td className="p-3 text-center font-black text-orange-600">{team.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* RIGHT: SIDEBAR (Top Scorers & Teams) */}
        <aside className="space-y-10">
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-600 mb-4">Top Scorers</h2>
            <div className="bg-white border-2 border-black rounded-2xl overflow-hidden">
              {leaders.map((stat: any, i) => (
                <div key={i} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-orange-50">
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase">{stat.players?.last_name}</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase">{stat.players?.team_id}</span>
                  </div>
                  <span className="text-sm font-black italic">{stat.points}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
