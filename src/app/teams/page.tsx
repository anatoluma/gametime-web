import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";
import { getPublicSeason, getVisibleSeasonTeams, type SeasonTeam } from "@/lib/league";
import Crest from "@/app/components/home/Crest";
import SectionHeading from "@/app/components/home/SectionHeading";

export const revalidate = 0;

export default async function TeamsPage() {
  const t = await getServerT();

  let list: SeasonTeam[];
  try {
    list = await getVisibleSeasonTeams(await getPublicSeason());
  } catch {
    return <div className="p-8 text-red-500 font-bold">{t("teams_error")}</div>;
  }

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6" style={{ background: "var(--navy-950)", color: "var(--text)" }}>
      <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-3xl uppercase leading-none sm:text-4xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          {t("teams_title")}
        </h1>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
          {t("teams_subtitle")}
        </p>
      </header>

      <SectionHeading title={t("teams_title")} href="/standings" linkLabel={t("home_standings_full")} headingClassName="text-lg" />

      <div className="flex flex-col gap-3">
        {list.map((team) => (
          <Link 
            key={team.team_id} 
            href={`/teams/${team.team_id}`}
            className="group flex items-center justify-between border p-4 transition-colors hover:border-[var(--orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)]"
            style={{
              borderColor: "var(--line)",
              borderRadius: "var(--radius)",
              background: "var(--navy-800)",
            }}
          >
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <Crest
                  teamId={team.team_id}
                  teamName={team.team_name}
                  size={28}
                  className="h-7 w-7 sm:!h-8 sm:!w-8"
                  imageClassName="h-full w-full object-contain"
                  fallbackClassName="text-xs sm:text-sm"
                />
                <h2 className="truncate text-sm font-semibold uppercase tracking-tight leading-none">
                  {team.team_name}
                </h2>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
                <span>{team.city ?? "General"}</span>
                <span className="opacity-30">|</span>
                <span>{t("teams_coach")} {team.coach ?? t("teams_unassigned")}</span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-4">
               <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{team.team_id}</span>
               <div className="flex h-8 w-8 items-center justify-center rounded-full border transition-all" style={{ borderColor: "var(--line)" }}>
                  <span className="text-sm font-semibold group-hover:text-[var(--orange)]">→</span>
               </div>
            </div>
          </Link>
        ))}
      </div>

      {list.length === 0 && (
        <p className="p-20 text-center text-lg font-semibold uppercase" style={{ color: "var(--muted)" }}>{t("teams_empty")}</p>
      )}
      </div>
    </main>
  );
}
