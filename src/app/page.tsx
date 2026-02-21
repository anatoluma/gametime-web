import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

export default async function Home() {
  // Fetch everything in parallel for a fast home page
  const [teamsRes, gamesRes, leadersRes] = await Promise.all([
    supabase.from("teams").select("team_id, team_name").limit(10),
    supabase.from("games").select("*").order("tipoff", { ascending: false }).limit(4),
    supabase.from("player_game_stats").select(`
      points,
      players (first_name, last_name, team_id)
    `).order("points", { ascending: false }).limit(5)
  ]);

  const teams = teamsRes.data ?? [];
  const recentGames = gamesRes.data ?? [];
  const leaders = leadersRes.data ?? [];

  return (
    <main className="min-h-screen bg-white">
      {/* HERO SECTION: The "Big League" Feel */}
      <section className="bg-black text-white py-16 px-6 border-b-8 border-orange-600 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <h1 className="text-7xl md:text-9xl font-black uppercase italic tracking-tighter leading-none">
            THE <span className="text-orange-600">LEAGUE</span><br />DATABASE
          </h1>
          <p className="mt-6 text-lg font-bold uppercase tracking-[0.3em] text-gray-400">
            Season 2025/26 • Official Statistics & Box Scores
          </p>
        </div>
        <div className="absolute top-0 right-0 text-[20rem] font-black italic text-white/5 select-none pointer-events-none translate-x-1/4">
          STATS
        </div>
      </section>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
        
        {/* COLUMN 1: LATEST RESULTS */}
        <section className="lg:col-span-2">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl font-black uppercase italic italic">Latest Scores</h2>
            <div className="h-1 flex-1 bg-black"></div>
            <Link href="/games" className="text-[10px] font-black uppercase border-2 border-black px-3 py-1 hover:bg-black hover:text-white transition-all">View All</Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentGames.map((game) => (
              <Link key={game.game_id} href={`/games/${game.game_id}`} className="border-2 border-gray-100 p-6 rounded-2xl hover:border-orange-600 transition-all group">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Final</span>
                  <span className="text-[10px] font-black text-gray-400 uppercase">
                    {game.tipoff ? new Date(game.tipoff).toLocaleDateString() : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-black uppercase text-lg">{game.home_team_id}</span>
                    <span className="text-2xl font-black italic">{game.home_score}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-black uppercase text-lg">{game.away_team_id}</span>
                    <span className="text-2xl font-black italic">{game.away_score}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* COLUMN 2: SIDEBAR (LEADERS & TEAMS) */}
        <aside className="space-y-12">
          {/* STAT LEADERS */}
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-orange-600 mb-6">Top Scorers</h2>
            <div className="bg-gray-50 rounded-2xl p-2 border-2 border-gray-100 shadow-sm">
              {leaders.map((stat: any, i) => (
                <div key={i} className="flex items-center justify-between p-3 border-b border-gray-200 last:border-0 hover:bg-white transition-colors rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black italic text-gray-300">#{i+1}</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase leading-none">{stat.players?.first_name} {stat.players?.last_name}</span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{stat.players?.team_id}</span>
                    </div>
                  </div>
                  <span className="text-lg font-black italic text-black">{stat.points}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TEAM DIRECTORY */}
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-orange-600 mb-6">Franchise Directory</h2>
            <div className="flex flex-wrap gap-2">
              {teams.map((t) => (
                <Link 
                  key={t.team_id} 
                  href={`/teams/${t.team_id}`}
                  className="px-3 py-1.5 border-2 border-black text-[10px] font-black uppercase hover:bg-orange-600 hover:text-white hover:border-orange-600 transition-all"
                >
                  {t.team_name}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
