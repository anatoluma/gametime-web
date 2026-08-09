import { Suspense } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import SeasonSelector from "@/app/components/SeasonSelector";
import { getServerT } from "@/lib/i18n/server";
import { getAvailableSeasons } from "@/lib/league";
import Crest from "@/app/components/home/Crest";
import RankBadge from "@/app/components/home/RankBadge";
import SectionHeading from "@/app/components/home/SectionHeading";

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

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const t = await getServerT();
  const { season: seasonParam } = await searchParams;

  const [seasons] = await Promise.all([getAvailableSeasons()]);
  const defaultSeason = seasons.find((s) => s.is_current)?.season ?? seasons[0]?.season ?? "2025/26";
  const selectedSeason = seasonParam ?? defaultSeason;

  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("home_team_id, away_team_id, home_score, away_score")
    .eq("season", selectedSeason)
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
      name: t.team_name ?? t.team_id,
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

  /* ... existing imports and logic stay the same ... */

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6" style={{ background: "var(--navy-950)", color: "var(--text)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl uppercase leading-none md:text-5xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {t("standings_title")}
          </h1>
          <div className="flex items-center gap-3">
            <Suspense fallback={null}>
              <SeasonSelector seasons={seasons} currentSeason={selectedSeason} />
            </Suspense>
          </div>
        </div>

        <SectionHeading title={t("standings_title")} href="/games" linkLabel={t("standings_full_schedule")} headingClassName="text-lg" />

        <div className="overflow-hidden border" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead style={{ background: "var(--navy-700)" }}>
                <tr className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
                  <th className="px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3">{t("standings_col_team")}</th>
                  <th className="px-3 py-3 text-center">GP</th>
                  <th className="px-3 py-3 text-center">W</th>
                  <th className="px-3 py-3 text-center">L</th>
                  <th className="px-3 py-3 text-right">PTS</th>
                  <th className="px-3 py-3 text-center">PF</th>
                  <th className="px-3 py-3 text-center">PA</th>
                  <th className="px-3 py-3 text-center">Diff</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((team, idx) => (
                  <tr key={team.team_id} style={{ borderTop: "1px solid var(--line)", background: idx % 2 === 1 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                    <td className="px-3 py-3 text-center">
                      <RankBadge rank={idx + 1} />
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/teams/${team.team_id}`}
                        className="flex items-center gap-2 text-xs font-semibold uppercase hover:text-[var(--orange)]"
                      >
                        <Crest teamId={team.team_id} teamName={team.name} size={26} />
                        <span className="truncate">{team.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "var(--muted)" }}>{team.gp}</td>
                    <td className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "var(--win)" }}>{team.w}</td>
                    <td className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "#fda4af" }}>{team.l}</td>
                    <td className="px-3 py-3 text-right text-xl leading-none" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{team.pts}</td>
                    <td className="px-3 py-3 text-center text-xs" style={{ color: "var(--muted)" }}>{team.pf}</td>
                    <td className="px-3 py-3 text-center text-xs" style={{ color: "var(--muted)" }}>{team.pa}</td>
                    <td className="px-3 py-3 text-center text-xs font-semibold" style={{ color: team.diff >= 0 ? "var(--win)" : "#fda4af" }}>{team.diff > 0 ? `+${team.diff}` : team.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
            <span>{t("standings_legend_win")}</span>
            <span>{t("standings_legend_loss")}</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
            {t("standings_tiebreakers")}
          </p>
        </div>
      </div>
    </main>
  );
}