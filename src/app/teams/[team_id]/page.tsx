"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useT } from "@/app/components/LanguageProvider";
import Crest from "@/app/components/home/Crest";
import SectionHeading from "@/app/components/home/SectionHeading";

type Team = { team_id: string; team_name: string; city: string | null; coach: string | null; };
type Player = { player_id: string; first_name: string; last_name: string; jersey_number: number | null; };
type Game = { game_id: string; season: string | null; tipoff: string | null; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null; };
type Summary = { gamesPlayed: number; wins: number; losses: number; pf: number; pa: number; diff: number; };
type TeamMap = Record<string, string>;

export default function TeamPage() {
  const params = useParams();
  const { t } = useT();

  const teamId = useMemo(() => {
    const raw = (params as any)?.team_id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  const [team, setTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [teamsById, setTeamsById] = useState<TeamMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!teamId) return;
      setLoading(true);
      setError(null);

      const { data: allTeams } = await supabase.from("teams").select("team_id, team_name");
      if (cancelled) return;
      const map: TeamMap = {};
      ((allTeams ?? []) as Array<{ team_id: string; team_name: string }>).forEach((t) => (map[t.team_id] = t.team_name));
      setTeamsById(map);

      const { data: teamData, error: teamError } = await supabase.from("teams").select("*").eq("team_id", teamId).maybeSingle();
      if (cancelled) return;
      if (teamError) { setError(teamError); setLoading(false); return; }
      if (!teamData) { setTeam(null); setLoading(false); return; }
      setTeam(teamData as Team);

      const [rosterRes, gamesRes] = await Promise.all([
        supabase.from("players").select("*").eq("team_id", teamId).order("last_name"),
        supabase.from("games").select("*").or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).order("tipoff", { ascending: false })
      ]);

      if (cancelled) return;
      setRoster((rosterRes.data ?? []) as Player[]);
      const allGames = (gamesRes.data ?? []) as Game[];
      setGames(allGames);

      const finished = allGames.filter(g => g.home_score != null && g.away_score != null);
      let wins = 0, losses = 0, pf = 0, pa = 0;
      for (const g of finished) {
        const isHome = g.home_team_id === teamId;
        const s = isHome ? (g.home_score ?? 0) : (g.away_score ?? 0);
        const c = isHome ? (g.away_score ?? 0) : (g.home_score ?? 0);
        pf += s; pa += c;
        if (s > c) wins += 1; else losses += 1;
      }
      setSummary({ gamesPlayed: finished.length, wins, losses, pf, pa, diff: pf - pa });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [teamId]);

  if (loading) return <div className="p-20 text-center font-semibold uppercase" style={{ color: "var(--muted)" }}>{t("team_loading")}</div>;
  if (!team) return <div className="p-20 text-center font-semibold uppercase tracking-widest text-red-400">{t("team_not_found")} ({teamId})</div>;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6" style={{ background: "var(--navy-950)", color: "var(--text)" }}>
      <div className="mx-auto max-w-6xl">
      {/* HEADER SECTION */}
      <header className="mb-10 border-b pb-7" style={{ borderColor: "var(--line)" }}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
             <span className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>{t("team_active")}</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-4 md:gap-5">
                <Crest teamId={team.team_id} teamName={team.team_name} size={44} className="sm:!h-14 sm:!w-14" />
                <h1 className="text-3xl uppercase tracking-tight leading-[0.9] break-words sm:text-5xl lg:text-6xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
                  {team.team_name}
                </h1>
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>
                {team.city ?? "Regional"} <span className="mx-2" style={{ color: "var(--orange)" }}>•</span> {t("team_head_coach")} {team.coach ?? "TBD"}
              </p>
            </div>

            {summary && (
              <div className="min-w-[180px] border px-5 py-4" style={{ borderColor: "var(--line)", background: "var(--navy-800)", borderRadius: "var(--radius)" }}>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{t("team_win_loss")}</div>
                <div className="text-4xl leading-none tabular-nums" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{summary.wins}-{summary.losses}</div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{summary.gamesPlayed} {t("team_games_played_suffix")}</div>
              </div>
            )}
          </div>
          <div className="h-0.5" style={{ background: "var(--line)" }}></div>
        </div>
      </header>

      {/* STATS STRIP */}
      {summary && (
        <div className="mb-14 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: t("team_stat_gp"), val: summary.gamesPlayed },
            { label: t("team_stat_pf"), val: summary.pf },
            { label: t("team_stat_pa"), val: summary.pa },
            { label: t("team_stat_diff"), val: summary.diff, color: summary.diff >= 0 ? "var(--win)" : "#fda4af" },
          ].map((stat, i) => (
            <div key={i} className="border p-4" style={{ borderColor: "var(--line)", background: "var(--navy-800)", borderRadius: "var(--radius)" }}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{stat.label}</div>
              <div className="text-3xl leading-none" style={{ color: stat.color ?? "var(--text)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{stat.val}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* RECENT GAMES */}
        <section>
          <SectionHeading title={t("team_recent_schedule")} href="/games" linkLabel={t("home_cta_results")} headingClassName="text-lg" />
          <div className="space-y-4">
            {games.slice(0, 8).map((g) => {
              const isWin = (g.home_team_id === teamId ? g.home_score! > g.away_score! : g.away_score! > g.home_score!);
              const isPlayed = g.home_score !== null;

              return (
                <Link key={g.game_id} href={`/games/${g.game_id}`} className="group flex items-center justify-between border p-4 transition-all hover:border-[var(--orange)]" style={{ borderColor: "var(--line)", background: "var(--navy-800)", borderRadius: "var(--radius)" }}>
                  {/* Left Column: Team Names */}
                  <div className="flex flex-col flex-1">
                    <span className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
                      {g.tipoff ? new Date(g.tipoff).toLocaleDateString() : "TBD"}
                    </span>
                    {/* Responsive Stack: Rows on Mobile, Line on Desktop */}
                    <div className="flex flex-col text-[11px] font-semibold uppercase tracking-tight md:flex-row md:items-center md:text-sm group-hover:text-[var(--orange)]">
                      <span>{teamsById[g.home_team_id] ?? g.home_team_id}</span>
                      <span className="text-[9px] md:mx-2 md:text-xs" style={{ color: "var(--muted)" }}>VS</span>
                      <span>{teamsById[g.away_team_id] ?? g.away_team_id}</span>
                    </div>
                  </div>

                  {/* Middle Column: W/L Indicator */}
                  <div className="flex items-center justify-center w-12">
                    {isPlayed && (
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-md min-w-[24px] text-center ${isWin ? 'text-black' : 'text-white'}`} style={{ background: isWin ? "var(--win)" : "#f87171" }}>
                        {isWin ? 'W' : 'L'}
                      </span>
                    )}
                  </div>

                  {/* Right Column: Score */}
                  <div className="text-right min-w-[70px]">
                    <span className="whitespace-nowrap text-lg tabular-nums md:text-xl" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                      {g.home_score ?? '--'} : {g.away_score ?? '--'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ROSTER */}
        <section>
          <SectionHeading title={t("team_roster")} href="/teams" linkLabel={t("teams_title")} headingClassName="text-lg" />
          <div className="overflow-hidden border" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}>
            <table className="w-full text-left">
              <thead>
                <tr style={{ background: "var(--navy-700)" }}>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.08em] w-20" style={{ color: "var(--muted)" }}>#</th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{t("team_col_athlete")}</th>
                  <th className="p-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-right" style={{ color: "var(--muted)" }}>Link</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => (
                  <tr key={p.player_id} className="group transition-colors hover:bg-white/5" style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="p-4 text-sm font-semibold" style={{ color: "var(--muted)" }}>{p.jersey_number ?? "--"}</td>
                    <td className="p-4">
                      <Link href={`/players/${p.player_id}`} className="text-sm font-semibold uppercase tracking-tight hover:text-[var(--orange)]">
                        {p.first_name} {p.last_name}
                      </Link>
                    </td>
                    <td className="p-5 text-right">
                      <Link href={`/players/${p.player_id}`} className="inline-block border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-all hover:border-[var(--orange)] hover:text-[var(--orange)]" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", color: "var(--muted)" }}>
                        {t("team_profile")}
                      </Link>
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