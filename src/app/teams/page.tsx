import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default async function TeamsPage() {
  const { data: teams, error } = await supabase
    .from("teams")
    .select("team_id, team_name, city, coach")
    .eq("is_active", true)
    .order("team_name");

  if (error) {
    return <div className="p-8 text-red-500 font-bold">Error loading teams.</div>;
  }

  const list = teams ?? [];

  return (
    <main className="p-4 md:p-12 max-w-4xl mx-auto bg-white min-h-screen">
      <header className="mb-12 border-b-2 border-gray-100 pb-6">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-gray-900">
          League Directory
        </h1>
        <p className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] mt-2">
          Official Team Registration • 2025/26
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {list.map((t) => (
          <Link 
            key={t.team_id} 
            href={`/teams/${t.team_id}`}
            className="group flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50/30 transition-all"
          >
            <div className="flex items-center gap-5">
              {/* COMPACT LOGO PLACEHOLDER */}
              <div className="w-12 h-12 bg-gray-100 text-gray-400 flex items-center justify-center text-xl font-black rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors shrink-0">
                {t.team_name?.[0]}
              </div>

              {/* TEAM INFO */}
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-gray-900 leading-none">
                  {t.team_name}
                </h2>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  <span className="text-gray-600">{t.city ?? "General"}</span>
                  <span className="opacity-30">|</span>
                  <span>Coach: {t.coach ?? "Unassigned"}</span>
                </div>
              </div>
            </div>

            {/* ACTION SIDE */}
            <div className="hidden sm:flex items-center gap-4">
               <span className="text-[10px] font-mono text-gray-300 group-hover:text-gray-400">{t.team_id}</span>
               <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center group-hover:bg-white group-hover:border-orange-500 transition-all">
                  <span className="text-sm font-bold group-hover:text-orange-600">→</span>
               </div>
            </div>
          </Link>
        ))}
      </div>

      {list.length === 0 && (
        <p className="p-20 text-center text-gray-400 italic font-bold uppercase tracking-widest">No teams found</p>
      )}
    </main>
  );
}
