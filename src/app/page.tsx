import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import TeamLogo from "@/app/components/TeamLogo";

export const revalidate = 0;

export default async function Home() {
  const [teamsRes, gamesRes, statsRes] = await Promise.all([
    supabase.from("teams").select("team_id, team_name").eq("is_active", true),
    supabase.from("games").select("*").order("tipoff", { ascending: false }),
    supabase.from("player_game_stats").select("player_id, points, players(first_name, last_name, team_id)"),
  ]);

  const teams = teamsRes.data ?? [];
  const allGames = gamesRes.data ?? [];
  const recentGames = allGames.slice(0, 4);
  const teamMap = new Map(teams.map(t => [t.team_id, t.team_name ?? t.team_id]));

  // --- STANDINGS LOGIC ---
  const table: Record<string, any> = {};
  teams.forEach(t => {
    table[t.team_id] = { name: t.team_name, id: t.team_id, w: 0, l: 0, pts: 0, pf: 0, pa: 0, diff: 0 };
  });

  allGames.forEach(g => {
    if (g.home_score !== null && g.away_score !== null) {
      const hs = Number(g.home_score);
      const as = Number(g.away_score);
      const home = table[g.home_team_id];
      const away = table[g.away_team_id];
      if (home && away) {
        home.pf += hs; home.pa += as;
        away.pf += as; away.pa += hs;
        if (hs > as) { home.w += 1; away.l += 1; home.pts += 2; away.pts += 1; }
        else { away.w += 1; home.l += 1; away.pts += 2; home.pts += 1; }
      }
    }
  });
  Object.keys(table).forEach(k => { table[k].diff = table[k].pf - table[k].pa; });
  const sortedStandings = Object.values(table)
    .sort((a: any, b: any) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf || a.name.localeCompare(b.name))
    .slice(0, 5);

  const gamesPlayed = allGames.filter(g => g.home_score !== null).length;

  // --- LEADERS LOGIC ---
  const statsData = statsRes.data ?? [];
  const ptsByPlayer: Record<string, { name: string; teamId: string; gp: number; pts: number }> = {};
  statsData.forEach((s: any) => {
    if (!s.player_id || !s.players) return;
    const fullName = [s.players.first_name, s.players.last_name].filter(Boolean).join(' ') || s.player_id;
    if (!ptsByPlayer[s.player_id]) {
      ptsByPlayer[s.player_id] = { name: fullName, teamId: s.players.team_id, gp: 0, pts: 0 };
    }
    ptsByPlayer[s.player_id].gp += 1;
    ptsByPlayer[s.player_id].pts += Number(s.points ?? 0);
  });
  const sortedLeaders = Object.entries(ptsByPlayer)
    .map(([id, v]) => ({ id, ...v, ppg: v.gp > 0 ? v.pts / v.gp : 0 }))
    .sort((a, b) => b.pts - a.pts || b.ppg - a.ppg)
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-white text-black">
      {/* PLAYOFFS BANNER */}
      <section className="relative w-full overflow-hidden">
        <img 
          src="/images/playoffs/round2.webp" 
          alt="Playoffs 2026 - Liga Basket Moldova"
          className="w-full h-auto object-cover"
        />
      </section>

      <section className="bg-gray-100 border-b-2 border-black py-4 px-3 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {recentGames.map((game) => {
            const dateObj = game.tipoff ? new Date(game.tipoff) : null;
            const now = new Date();
            const isFinished = game.home_score !== null && game.away_score !== null && dateObj && dateObj < now;
            const timeText = dateObj ? dateObj.toLocaleTimeString('ro-RO', { timeZone: 'Europe/Chisinau', hour: '2-digit', minute: '2-digit' }) : "TBD";
            
            return (
              <Link key={game.game_id} href={`/games/${game.game_id}`} className="bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all">
                {/* Date/Time header */}
                <div className="flex items-center justify-between mb-2 text-[9px] font-medium text-gray-500">
                  <div className="flex items-center gap-1">
                    <span>{dateObj ? dateObj.toLocaleDateString('ro-RO', { timeZone: 'Europe/Chisinau', month: 'short', day: 'numeric' }) : ""}</span>
                    <span>•</span>
                    <span className="text-gray-700">{timeText}</span>
                  </div>
                  <span className={isFinished ? "text-emerald-600" : "text-orange-500"}>
                    {isFinished ? "Final" : "Scheduled"}
                  </span>
                </div>
                
                {/* Teams layout */}
                <div className="space-y-1">
                  {/* Home Team */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 flex-1">
                      <TeamLogo teamId={game.home_team_id} size={16} className="shrink-0" />
                      <span className="text-[9px] font-black uppercase leading-tight">{teamMap.get(game.home_team_id) ?? game.home_team_id}</span>
                    </div>
                    {isFinished ? (
                      <span className="text-[10px] font-black shrink-0 ml-1">{game.home_score}</span>
                    ) : null}
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 flex-1">
                      <TeamLogo teamId={game.away_team_id} size={16} className="shrink-0" />
                      <span className="text-[9px] font-black uppercase leading-tight">{teamMap.get(game.away_team_id) ?? game.away_team_id}</span>
                    </div>
                    {isFinished ? (
                      <span className="text-[10px] font-black shrink-0 ml-1">{game.away_score}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. MAIN TABLES GRID */}
      <div className="px-3 sm:px-6 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10 items-start">
        
        {/* STANDINGS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black uppercase italic">Standings</h2>
            <Link href="/standings" className="text-xs font-bold border-b-2 border-black text-black">Full Table</Link>
          </div>
          <div className="border-2 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)] min-h-[360px]">
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
                    <td className="p-3 font-black uppercase text-[11px]">
                      <Link href={`/teams/${team.id}`} className="flex items-center gap-2 hover:text-orange-600 transition-colors">
                        <span className="text-gray-300 shrink-0"># {i+1}</span>
                        <TeamLogo teamId={team.id} size={20} className="shrink-0" />
                        <span className="truncate max-w-[110px] md:max-w-none">{team.name}</span>
                      </Link>
                    </td>
                    <td className="p-3 text-center text-xs font-bold">{team.w}-{team.l}</td>
                    <td className="p-3 text-center font-black text-orange-600">{team.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* LEADERS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black uppercase italic">Top Scorers</h2>
            <Link href="/leaders" className="text-xs font-bold border-b-2 border-black text-black">Full Leaders</Link>
          </div>
          <div className="border-2 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)] min-h-[360px]">
            <table className="w-full text-left bg-white">
              <thead className="bg-gray-900 text-white text-[9px] uppercase tracking-widest">
                <tr>
                  <th className="p-3">Player</th>
                  <th className="p-3 text-center">GP</th>
                  <th className="p-3 text-center">PPG</th>
                  <th className="p-3 text-center">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedLeaders.map((p: any, i) => (
                  <tr key={i} className="hover:bg-orange-50 transition-colors">
                    <td className="p-3 px-3 font-black uppercase text-[11px]">
                      <Link href={`/players/${p.id}`} className="group flex items-center gap-2 hover:text-orange-600 transition-colors">
                        <span className="text-gray-300 shrink-0"># {i + 1}</span>
                        <TeamLogo teamId={p.teamId} size={20} className="shrink-0" />
                        <span className="truncate max-w-[130px] md:max-w-none">{p.name}</span>
                      </Link>
                    </td>
                    <td className="p-3 text-center text-xs font-bold text-gray-600">{p.gp}</td>
                    <td className="p-3 text-center text-xs font-bold text-gray-600">{p.ppg.toFixed(1)}</td>
                    <td className="p-3 text-center font-black text-orange-600">{p.pts}</td>
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
