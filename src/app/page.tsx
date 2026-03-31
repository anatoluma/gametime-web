import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import TeamLogo from "@/app/components/TeamLogo";

export const revalidate = 0;

export default async function Home() {
  const [teamsRes, gamesRes, leadersRes] = await Promise.all([
    supabase.from("teams").select("team_id, team_name").eq("is_active", true),
    supabase.from("games").select("*").order("tipoff", { ascending: false }),
    // Fetch all stats to calculate real leaders (Total Points)
    supabase.from("player_game_stats").select(`
      player_id,
      points,
      players (first_name, last_name, team_id)
    `)
  ]);

  const teams = teamsRes.data ?? [];
  const allGames = gamesRes.data ?? [];
  const recentGames = allGames.slice(0, 4);
  const rawStats = leadersRes.data ?? [];
  const teamMap = new Map(teams.map(t => [t.team_id, t.team_name ?? t.team_id]));

  // --- 1. STANDINGS LOGIC ---
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

  // --- 2. LEADERS LOGIC (Aggregated to match Leaders Page) ---
  const playerMap = new Map<string, any>();
  rawStats.forEach((s: any) => {
    const pid = s.player_id;
    const pts = s.points ?? 0;
    const existing = playerMap.get(pid);
    if (!existing) {
      playerMap.set(pid, {
        id: pid,
        name: `${s.players?.first_name} ${s.players?.last_name}`,
        team: s.players?.team_id,
        pts: pts,
        gp: 1
      });
    } else {
      existing.pts += pts;
      existing.gp += 1;
    }
  });

  const sortedLeaders = Array.from(playerMap.values())
    .sort((a, b) => b.pts - a.pts || b.gp - a.gp) // Primary: Total PTS, Secondary: Games Played
    .slice(0, 5);

  const gamesPlayed = allGames.filter(g => g.home_score !== null).length;

  return (
    <main className="min-h-screen bg-white text-black">
      {/* HERO BANNER */}
      <section className="relative overflow-hidden bg-gray-950 text-white border-b-4 border-orange-500">
        {/* Decorative radial glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-0 h-full w-1/2 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-full w-1/2 rounded-full bg-blue-800/20 blur-3xl" />
        </div>
        {/* Decorative basketball circle */}
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 hidden sm:block">
          <div className="h-48 w-48 md:h-64 md:w-64 rounded-full border-[16px] border-orange-500/10 opacity-60" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-28 w-28 md:h-40 md:w-40 rounded-full border-[10px] border-orange-500/8" />
          </div>
        </div>

        <div className="relative mx-auto max-w-screen-xl px-4 sm:px-6 py-8 sm:py-10 md:py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

            {/* Left: branding + CTAs */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-orange-400 text-[10px] font-black uppercase tracking-[0.2em]">Official Stats Platform</span>
                <span className="h-px w-8 bg-orange-400/60 inline-block" />
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Season 2025/26</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase leading-none tracking-tight">
                Liga Basket<br />
                <span className="text-orange-400">Moldova</span>
              </h1>
              <p className="mt-3 text-sm text-gray-400 max-w-xs">
                Scores, standings, and player stats for every game of the season.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/games" className="bg-orange-500 hover:bg-orange-400 text-white text-xs font-black uppercase px-5 py-2.5 rounded-lg transition-colors">
                  All Games
                </Link>
                <Link href="/standings" className="border border-white/20 hover:bg-white/10 text-white text-xs font-black uppercase px-5 py-2.5 rounded-lg transition-colors">
                  Standings
                </Link>
                <Link href="/leaders" className="border border-white/20 hover:bg-white/10 text-white text-xs font-black uppercase px-5 py-2.5 rounded-lg transition-colors">
                  Leaders
                </Link>
              </div>
            </div>

            {/* Right: stat tiles + leader card */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/8 border border-white/10 p-4 text-center">
                <div className="text-3xl font-black">{teams.length}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-gray-400">Teams</div>
              </div>
              <div className="rounded-xl bg-white/8 border border-white/10 p-4 text-center">
                <div className="text-3xl font-black">{gamesPlayed}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-gray-400">Games</div>
              </div>
              <div className="rounded-xl bg-white/8 border border-white/10 p-4 text-center">
                <div className="text-3xl font-black text-orange-400">{sortedLeaders[0]?.pts ?? 0}</div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-gray-400">Top PTS</div>
              </div>

              {sortedLeaders[0] && (
                <div className="col-span-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-400 mb-1">Scoring Leader</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-black uppercase leading-snug">{sortedLeaders[0].name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{sortedLeaders[0].team} · {sortedLeaders[0].gp} games</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-orange-400 leading-none">{sortedLeaders[0].pts}</div>
                      <div className="text-[9px] uppercase tracking-widest text-gray-500 mt-1">Total PTS</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-100 border-b-2 border-black py-4 px-3 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {recentGames.map((game) => (
            <Link key={game.game_id} href={`/games/${game.game_id}`} className="bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TeamLogo teamId={game.home_team_id} size={18} className="shrink-0" />
                  <span className="text-[10px] font-black uppercase truncate">{teamMap.get(game.home_team_id) ?? game.home_team_id}</span>
                </div>
                <span className="text-[11px] font-black shrink-0 ml-1">{game.home_score ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TeamLogo teamId={game.away_team_id} size={18} className="shrink-0" />
                  <span className="text-[10px] font-black uppercase truncate">{teamMap.get(game.away_team_id) ?? game.away_team_id}</span>
                </div>
                <span className="text-[11px] font-black shrink-0 ml-1">{game.away_score ?? 0}</span>
              </div>
            </Link>
          ))}
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

        {/* COMPRESSED TOP SCORERS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black uppercase italic text-orange-600">Top Scorers</h2>
            <Link href="/leaders" className="text-xs font-bold border-b-2 border-black text-black">All Leaders</Link>
          </div>
          <div className="bg-white border-2 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)] min-h-[360px]">
            <table className="w-full text-left bg-white">
              <thead className="bg-gray-900 text-white text-[9px] uppercase tracking-widest">
                <tr>
                  <th className="p-3">Player</th>
                  <th className="p-3 text-center">GP</th>
                  <th className="p-3 text-center">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedLeaders.map((p: any, i) => (
                  <tr key={i} className="hover:bg-orange-50 transition-colors">
                    <td className="p-3 px-3">
                      <Link href={`/players/${p.id}`} className="group flex flex-col leading-tight">
                        <span className="text-[11px] font-black uppercase group-hover:text-orange-600 transition-colors truncate max-w-[140px] md:max-w-none">
                          {p.name}
                        </span>
                        <span className="text-[8px] font-bold text-gray-400 uppercase">{p.team}</span>
                      </Link>
                    </td>
                    <td className="p-2.5 text-center text-xs font-bold text-gray-500">{p.gp}</td>
                    <td className="p-2.5 text-center font-black text-gray-900 italic">{p.pts}</td>
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
