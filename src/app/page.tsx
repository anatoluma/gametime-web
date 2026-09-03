import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { Inter, Oswald } from "next/font/google";
import { getServerT } from "@/lib/i18n/server";
import Crest from "@/app/components/home/Crest";
import RankBadge from "@/app/components/home/RankBadge";
import SectionHeading from "@/app/components/home/SectionHeading";
import StatTile from "@/app/components/home/StatTile";
import Eyebrow from "@/app/components/home/Eyebrow";
import SeasonCountdown from "@/app/components/home/SeasonCountdown";
import GameCard from "@/app/components/home/GameCard";
import { getAvailableSeasons, getPublicSeason, getVisibleSeasonTeams } from "@/lib/league";

const inter = Inter({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"] });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });

export const revalidate = 0;

function StatIcon({ type }: { type: "teams" | "games" | "players" | "playoffs" }) {
  if (type === "teams") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="3" />
        <path d="M20 8v6" />
        <path d="M23 11h-6" />
      </svg>
    );
  }

  if (type === "games") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="M3 10h18" />
      </svg>
    );
  }

  if (type === "players") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 0 0 16" />
        <path d="M12 4a8 8 0 0 1 0 16" />
        <path d="M4 12h16" />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3l2.2 4.5L19 8.2l-3.5 3.4.8 4.8L12 14l-4.3 2.4.8-4.8L5 8.2l4.8-.7L12 3z" />
    </svg>
  );
}

export default async function Home() {
  const t = await getServerT();
  const [season, availableSeasons] = await Promise.all([getPublicSeason(), getAvailableSeasons()]);
  const nextSeason = availableSeasons.find((availableSeason) => availableSeason.season > season)?.season;
  const scheduleSeason = nextSeason ?? season;
  const [seasonTeams, gamesRes, scheduleRes, allTeamsRes] = await Promise.all([
    getVisibleSeasonTeams(season),
    supabase.from("games").select("*").eq("season", season).order("tipoff", { ascending: false }),
    supabase.from("games").select("*").eq("season", scheduleSeason).order("tipoff", { ascending: true }),
    // Every franchise ever, purely for labelling games — the standings set below
    // is season-scoped, but a game must never render without its team name.
    supabase.from("teams").select("team_id, team_name, logo_url"),
  ]);

  const statsData: any[] = [];
  const statsPageSize = 1000;
  for (let start = 0; ; start += statsPageSize) {
    const { data } = await supabase
      .from("player_game_stats")
      .select("player_id, points, players(first_name, last_name, team_id)")
      .order("game_id")
      .order("player_id")
      .range(start, start + statsPageSize - 1);
    statsData.push(...(data ?? []));
    if (!data || data.length < statsPageSize) break;
  }

  const teams = seasonTeams;
  const allGames = gamesRes.data ?? [];
  const now = new Date();
  const recentGames = allGames
    .filter((game) => game.home_score !== null && game.away_score !== null && game.tipoff && new Date(game.tipoff) < now)
    .slice(0, 4);
  const upcomingGames = (scheduleRes.data ?? [])
    .filter((game) => game.home_score === null && game.away_score === null && game.tipoff && new Date(game.tipoff) >= now)
    .slice(0, 4);
  const teamMap = new Map(
    (allTeamsRes.data ?? []).map(t => [t.team_id, { name: t.team_name ?? t.team_id, logoUrl: t.logo_url }])
  );

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
  const totalPlayers = new Set(statsData.map((s: any) => s.player_id)).size;
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
    <main className={`${inter.variable} ${oswald.variable} min-h-screen`} style={{ background: "var(--navy-950)", color: "var(--text)", fontFamily: "var(--font-body)" }}>
      <SeasonCountdown
        label={t("home_countdown_label")}
        daysLabel={t("home_countdown_days")}
        dateLabel={t("home_countdown_date")}
      />

      <section className="lbm-hero-bg border-b px-3 pb-6 pt-6 sm:px-6 sm:pt-7" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto max-w-5xl">
          <Eyebrow>{t("home_eyebrow")}</Eyebrow>

          <h1 className="mt-3 text-4xl leading-none sm:text-5xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {t("home_title")}
          </h1>

          <p className="mt-3 max-w-3xl text-sm sm:text-base" style={{ color: "var(--muted)" }}>
            {t("home_subtitle")}
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/games"
              className="inline-flex items-center justify-center border px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)]"
              style={{
                borderRadius: "var(--radius)",
                borderColor: "#ff9d58",
                background: "linear-gradient(135deg, #ff7a1a 0%, #ff9a4a 100%)",
                color: "#1f1309",
              }}
            >
              {t("home_cta_results")}
            </Link>

            <Link
              href="/leaders"
              className="inline-flex items-center justify-center border px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] transition-colors hover:border-[var(--orange)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)]"
              style={{
                borderRadius: "var(--radius)",
                border: "1.5px solid var(--line)",
                background: "transparent",
                color: "var(--muted)",
              }}
            >
              {t("home_cta_leaders")}
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={<StatIcon type="teams" />} value={teams.length} label={t("home_stat_teams")} href="/teams" />
            <StatTile icon={<StatIcon type="games" />} value={gamesPlayed} label={t("home_stat_games")} href="/games" />
            <StatTile icon={<StatIcon type="players" />} value={totalPlayers} label={t("home_stat_players")} href="/leaders" />
            <StatTile icon={<StatIcon type="playoffs" />} value={t("home_stat_playoffs")} label={t("home_stat_playoffs_sub")} href="/games" />
          </div>
        </div>
      </section>

      <section className="border-b px-3 py-5 sm:px-6" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            title={t("games_recent")}
            href="/games"
            linkLabel={t("home_cta_results")}
            headingClassName="text-lg"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentGames.map((game) => <GameCard key={game.game_id} game={game} teamMap={teamMap} t={t} />)}
          </div>

          {upcomingGames.length > 0 ? (
            <div className="mt-8">
              <SectionHeading
                title={t("home_schedule")}
                href="/games"
                linkLabel={t("home_cta_schedule")}
                headingClassName="text-lg"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {upcomingGames.map((game) => <GameCard key={game.game_id} game={game} teamMap={teamMap} t={t} />)}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="px-3 py-6 sm:px-6 md:py-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
          <section>
            <SectionHeading
              title={t("home_section_standings")}
              href="/standings"
              linkLabel={t("home_standings_full")}
            />

            <div className="overflow-hidden border" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}>
              <table className="w-full text-left">
                <thead style={{ background: "var(--navy-700)" }}>
                  <tr className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
                    <th className="px-3 py-3">{t("home_standings_team")}</th>
                    <th className="px-3 py-3 text-center">W-L</th>
                    <th className="px-3 py-3 text-right">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStandings.map((team: any, i) => (
                    <tr
                      key={team.id}
                      style={{
                        borderTop: "1px solid var(--line)",
                        background: i % 2 === 1 ? "rgba(255,255,255,0.02)" : "transparent",
                      }}
                    >
                      <td className="px-3 py-3">
                        <Link
                          href={`/teams/${team.id}`}
                          className="flex items-center gap-2 text-xs font-semibold uppercase transition-colors hover:text-[var(--orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)]"
                        >
                          <RankBadge rank={i + 1} />
                          <Crest teamId={team.id} teamName={team.name} logoUrl={teams.find((item) => item.team_id === team.id)?.logo_url} size={26} />
                          <span className="truncate">{team.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-semibold" style={{ color: "var(--muted)" }}>
                        {team.w}-{team.l}
                      </td>
                      <td className="px-3 py-3 text-right text-xl leading-none" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                        {team.pts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <SectionHeading
              title={t("home_section_leaders")}
              href="/leaders"
              linkLabel={t("home_leaders_full")}
            />

            <div className="overflow-hidden border" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}>
              <table className="w-full text-left">
                <thead style={{ background: "var(--navy-700)" }}>
                  <tr className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
                    <th className="px-3 py-3">{t("home_leaders_player")}</th>
                    <th className="px-3 py-3 text-right">GP</th>
                    <th className="px-3 py-3 text-right">PPG</th>
                    <th className="px-3 py-3 text-right">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaders.map((p: any, i) => (
                    <tr
                      key={p.id}
                      style={{
                        borderTop: "1px solid var(--line)",
                        background: i % 2 === 1 ? "rgba(255,255,255,0.02)" : "transparent",
                      }}
                    >
                      <td className="px-3 py-3">
                        <Link
                          href={`/players/${p.id}`}
                          className="flex items-center gap-2 text-xs font-semibold uppercase transition-colors hover:text-[var(--orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)]"
                        >
                          <RankBadge rank={i + 1} />
                          <Crest teamId={p.teamId} teamName={teamMap.get(p.teamId)?.name ?? p.teamId} logoUrl={teamMap.get(p.teamId)?.logoUrl} size={26} />
                          <span className="truncate">{p.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-semibold" style={{ color: "var(--muted)" }}>
                        {p.gp}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-semibold" style={{ color: "var(--muted)" }}>
                        {p.ppg.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 text-right text-xl leading-none" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                        {p.pts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
