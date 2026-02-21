import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

export default async function Home() {
  // Fetch everything in parallel for maximum speed
  const [teamsRes, gamesRes, leadersRes] = await Promise.all([
    supabase.from("teams").select("team_id, team_name").limit(12),
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
    <main className="min-h-screen bg-white text-black">
      {/* 1. HERO SECTION: Force Black/Orange Contrast */}
      <section className="bg-black text-white py-12 md:py-20 px-6 border-b-[12px] border-orange-600 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <h1 className="text-6xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.8] mb-4">
            LEAGUE <span className="text-orange-600">CENTRAL</span>
          </h1>
          <p className="text-sm md:text-lg font-black uppercase tracking-[0.4em] text-gray-400">
            Official 2025/26 Season Hub • Chisinau, Moldova
          </p>
        </div>
        {/* Large Decorative Text */}
        <div className="absolute top-0 right-0 text-[15rem] font-black italic text-white/[0.03] select-none pointer-events-none translate-x-1/4">
          STATS
        </div>
      </section>

      {/* 2. MAIN CONTENT GRID */}
      <div className="max-w-6xl mx-auto p-4 md:p-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* LEFT/MIDDLE: RECENT SCORES (Fixes 1000037210.jpg visibility) */}
        <section className="lg:col-span-2">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl font-black uppercase italic">Recent Results</h2>
            <div className="h-1 flex-1 bg-black"></div>
            <Link href="/games" className="text-[10px] font-black uppercase border-2 border-black px-4 py-1.5 hover:bg-black hover:text-white transition-all">
              Full Schedule →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recentGames.map((game) => (
              <Link 
                key={game.game_id} 
                href={`/games/${game.game_id}`} 
                className="group border-4 border-black p-6 rounded-3xl hover:bg-orange-50 transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]"
              >
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-2">
                  <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">Final</span>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {game.tipoff ? new Date(game.tipoff).toLocaleDateString() : "TBD"}
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-black uppercase text-xl text-black group-hover:text-orange-600">{game.home_team_id}</span>
                    <span className="text-3xl font-black italic text-black">{game.home_score ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-black uppercase text-xl text-black group-hover:text-orange-600">{game.away_team_id}</span>
                    <span className="text-3xl font-black italic text-black">{game.away_score ?? 0}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* RIGHT: SIDEBAR (Leaders & Directory) */}
        <aside className="space-y-12">
          {/* TOP SCORERS BOX (Fixes 1000037209.jpg visibility) */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-orange-600 mb-6">Top Scorers</h2>
            <div className="bg-white border-4 border-black rounded-3xl overflow-hidden">
              {leaders.map((stat: any, i) => (
                <div key={i} className="flex items-center justify-between p-4 border-b-2 border-gray-100 last:border-0 hover:bg-orange-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black italic text-gray-300">#{i+1}</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-black uppercase text-black leading-none">
                        {stat.players?.first_name} {stat.players?.last_name}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 uppercase">{stat.players?.team_id}</span>
                    </div>
                  </div>
                  <span className="text-xl font-black italic text-black">{stat.points}</span>
                </div>
              ))}
            </div>
          </section>

          {/* QUICK DIRECTORY (Improved Grid) */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-black mb-6">Team Directory</h2>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => (
                <Link 
                  key={t.team_id} 
                  href={`/teams/${t.team_id}`}
                  className="p-3 border-2 border-black text-[10px] font-black uppercase text-center hover:bg-black hover:text-white transition-all rounded-xl"
                >
                  {t.team_name}
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
