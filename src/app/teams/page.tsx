import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import TeamLogo from "@/app/components/TeamLogo";

export const revalidate = 0;

export default async function TeamsPage() {
  const { data: teams, error } = await supabase
    .from("teams")
    .select("team_id, team_name, city, coach")
    .eq("is_active", true)
    .neq("team_id", "VET")
    .order("team_name");

  if (error) {
    return <div className="p-8 text-red-500 font-bold">Error loading teams.</div>;
  }

  const list = teams ?? [];

  return (
    <main className="p-4 md:p-12 max-w-4xl mx-auto bg-[var(--surface)] min-h-screen">
      <header className="mb-10 border-b border-[var(--border)] pb-6">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          League Directory
        </h1>
        <p className="text-xs font-medium text-[var(--text-muted)] mt-2">
          Official team registration, 2025/26 season
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {list.map((t) => (
          <Link 
            key={t.team_id} 
            href={`/teams/${t.team_id}`}
            className="group flex items-center justify-between p-4 border border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:bg-[var(--surface-muted)] transition-all"
          >
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <TeamLogo
                  teamId={t.team_id}
                  teamName={t.team_name}
                  size={28}
                  className="w-7 h-7 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] object-cover shrink-0"
                />
                <h2 className="text-sm font-semibold tracking-tight leading-none truncate">
                  {t.team_name}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--text-muted)] tracking-wide">
                <span>{t.city ?? "General"}</span>
                <span className="opacity-30">|</span>
                <span>Coach: {t.coach ?? "Unassigned"}</span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-4">
               <span className="text-[11px] font-mono text-[var(--text-muted)]">{t.team_id}</span>
               <div className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] transition-all">
                  <span className="text-sm font-semibold group-hover:text-[var(--accent)]">→</span>
               </div>
            </div>
          </Link>
        ))}
      </div>

      {list.length === 0 && (
        <p className="p-20 text-center text-[var(--text-muted)] text-lg font-medium">No teams found</p>
      )}
    </main>
  );
}
