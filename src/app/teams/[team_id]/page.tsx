"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useT } from "@/app/components/LanguageProvider";
import Crest from "@/app/components/home/Crest";
import SectionHeading from "@/app/components/home/SectionHeading";
import PlayerAvatar from "@/app/components/PlayerAvatar";
import TeamLogo from "@/app/components/TeamLogo";

type Team = { team_id: string; team_name: string; city: string | null; coach: string | null; logo_url: string | null; };
type Player = { player_id: string; first_name: string; last_name: string; jersey_number: number | null; photo_url: string | null; position?: string | null; };
type Game = { game_id: string; season: string | null; tipoff: string | null; scheduled_date?: string | null; status?: string | null; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null; };
type Summary = { gamesPlayed: number; wins: number; losses: number; pf: number; pa: number; diff: number; };
type TeamMap = Record<string, { name: string; logoUrl: string | null }>;

function isCompletedGame(game: Game) {
  if (game.status) return ["completed", "complete", "final", "finished"].includes(game.status.toLowerCase());
  return game.home_score !== null && game.away_score !== null;
}

function formatGameDate(game: Game) {
  const value = game.tipoff ?? game.scheduled_date;
  return value ? new Date(value).toLocaleDateString() : "";
}

function formatGameTime(game: Game) {
  if (!game.tipoff) return null;
  const date = new Date(game.tipoff);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function compareRosterPlayers(left: Player, right: Player) {
  const leftNumber = left.jersey_number;
  const rightNumber = right.jersey_number;
  const hasLeftNumber = Number.isInteger(leftNumber) && (leftNumber as number) >= 0;
  const hasRightNumber = Number.isInteger(rightNumber) && (rightNumber as number) >= 0;

  if (hasLeftNumber && hasRightNumber && leftNumber !== rightNumber) return (leftNumber as number) - (rightNumber as number);
  if (hasLeftNumber !== hasRightNumber) return hasLeftNumber ? -1 : 1;
  return `${left.last_name} ${left.first_name}`.localeCompare(`${right.last_name} ${right.first_name}`, undefined, { sensitivity: "base" });
}

export default function TeamPage() {
  const params = useParams();
  const { t } = useT();

  const teamId = useMemo(() => {
    const raw = (params as { team_id?: string | string[] })?.team_id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  const [team, setTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [teamsById, setTeamsById] = useState<TeamMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!teamId) return;
      setLoading(true);

      const { data: allTeams } = await supabase.from("teams").select("team_id, team_name, logo_url");
      if (cancelled) return;
      const map: TeamMap = {};
      ((allTeams ?? []) as Array<{ team_id: string; team_name: string; logo_url: string | null }>).forEach((t) => (map[t.team_id] = { name: t.team_name, logoUrl: t.logo_url }));
      setTeamsById(map);

      const { data: teamData, error: teamError } = await supabase.from("teams").select("*").eq("team_id", teamId).maybeSingle();
      if (cancelled) return;
      if (teamError) { setLoading(false); return; }
      if (!teamData) { setTeam(null); setLoading(false); return; }
      setTeam(teamData as Team);

      const [rosterRes, gamesRes] = await Promise.all([
        supabase.from("players").select("*").eq("team_id", teamId).order("last_name"),
        supabase.from("games").select("*").or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).order("tipoff", { ascending: false })
      ]);

      if (cancelled) return;
      setRoster([...(rosterRes.data ?? []) as Player[]].sort(compareRosterPlayers));
      const allGames = (gamesRes.data ?? []) as Game[];
      setGames(allGames);

      const finished = allGames.filter(isCompletedGame);
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
          <div className="flex flex-col gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-4 md:gap-5">
                <TeamLogo
                  teamId={team.team_id}
                  teamName={team.team_name}
                  logoUrl={team.logo_url}
                  size={80}
                  className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16 lg:h-20 lg:w-20"
                />
                <h1 className="text-3xl uppercase tracking-tight leading-[0.9] break-words sm:text-5xl lg:text-6xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
                  {team.team_name}
                </h1>
              </div>
              {(team.city || team.coach) && (
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted)" }}>
                  {team.city && <span>{team.city}</span>}
                  {team.city && team.coach && <span className="mx-2" style={{ color: "var(--orange)" }}>•</span>}
                  {team.coach && <span>{t("team_head_coach")} {team.coach}</span>}
                </p>
              )}
            </div>
          </div>
          <div className="h-0.5" style={{ background: "var(--line)" }}></div>
        </div>
      </header>

      {/* STATS STRIP */}
      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: t("team_stat_gp"), val: summary.gamesPlayed },
            { label: t("team_win_loss"), val: `${summary.wins}-${summary.losses}`, color: "var(--orange)" },
            { label: t("team_stat_win_pct"), val: summary.gamesPlayed ? `${((summary.wins / summary.gamesPlayed) * 100).toFixed(1)}%` : "0.0%" },
            { label: t("team_stat_pf_pg"), val: summary.gamesPlayed ? (summary.pf / summary.gamesPlayed).toFixed(1) : "0.0" },
            { label: t("team_stat_pa_pg"), val: summary.gamesPlayed ? (summary.pa / summary.gamesPlayed).toFixed(1) : "0.0" },
            { label: t("team_stat_diff_pg"), val: summary.gamesPlayed ? (summary.diff / summary.gamesPlayed).toFixed(1) : "0.0" },
          ].map((stat, i) => (
            <div key={i} className="border p-4" style={{ borderColor: "var(--line)", background: "var(--navy-800)", borderRadius: "var(--radius)" }}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{stat.label}</div>
              <div className="text-3xl leading-none" style={{ color: stat.color ?? "var(--text)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{stat.val}</div>
            </div>
          ))}
        </div>
      )}

      {summary && summary.gamesPlayed > 0 && (
        <div className="mb-14 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
          <span>{t("team_recent_form")}</span>
          <div className="flex gap-1.5" aria-label={t("team_recent_form")}>
            {games.filter(isCompletedGame).slice(0, 5).map((game) => {
              const teamScore = game.home_team_id === teamId ? game.home_score ?? 0 : game.away_score ?? 0;
              const opponentScore = game.home_team_id === teamId ? game.away_score ?? 0 : game.home_score ?? 0;
              const won = teamScore > opponentScore;
              return <span key={game.game_id} className="inline-flex h-6 min-w-6 items-center justify-center rounded text-[10px]" style={{ background: won ? "var(--win)" : "#f87171", color: won ? "#111827" : "white" }}>{won ? "W" : "L"}</span>;
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-10">
        {/* RECENT GAMES */}
        <section>
          {(() => {
            const completedGames = games.filter(isCompletedGame).slice(0, 8);
            const upcomingGames = games.filter((game) => !isCompletedGame(game)).slice(0, 1);
            const renderGames = (items: Game[], emptyLabel: string) => items.length ? <div className="space-y-3">{items.map((g) => {
              const played = isCompletedGame(g);
              const teamIsHome = g.home_team_id === teamId;
              const teamScore = teamIsHome ? g.home_score : g.away_score;
              const opponentScore = teamIsHome ? g.away_score : g.home_score;
              const won = played && (teamScore ?? 0) > (opponentScore ?? 0);
              const homeName = teamsById[g.home_team_id]?.name ?? g.home_team_id;
              const awayName = teamsById[g.away_team_id]?.name ?? g.away_team_id;
              const opponentId = teamIsHome ? g.away_team_id : g.home_team_id;
              const opponentName = teamIsHome ? awayName : homeName;
              const opponent = teamsById[opponentId];
              return <article key={g.game_id} className="border transition-colors hover:border-[var(--orange)] focus-within:border-[var(--orange)]" style={{ borderColor: "var(--line)", background: "var(--navy-800)", borderRadius: "var(--radius)" }}>
                <div className="flex min-h-20 items-center gap-3 p-3 sm:p-4">
                  {opponent?.logoUrl && <Crest teamId={opponentId} teamName={opponentName} logoUrl={opponent.logoUrl} size={34} />}
                  <Link href={`/games/${g.game_id}`} className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-800)]">
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
                      <span>{formatGameDate(g) || t("team_date_tbd")}</span><span>•</span><span>{teamIsHome ? t("game_home") : t("game_away")}</span>
                    </div>
                    <div className="min-w-0 text-sm font-semibold uppercase"><span style={{ color: "var(--text)" }}>{teamIsHome ? homeName : awayName}</span><span className="mx-1.5" style={{ color: "var(--muted)" }}>vs</span><span className="truncate" style={{ color: "var(--muted)" }}>{opponentName}</span></div>
                  </Link>
                  <div className="shrink-0 text-right">
                    {played ? <><div className="text-xl tabular-nums" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{g.home_score} : {g.away_score}</div><span className="text-[10px] font-semibold" style={{ color: won ? "var(--win)" : "#f87171" }}>{won ? "W" : "L"}</span></> : <span className="text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>{formatGameTime(g) ?? t("team_upcoming")}</span>}
                  </div>
                </div>
                <Link href={`/teams/${opponentId}`} className="block border-t px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] hover:text-[var(--orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)]" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>{opponentName}</Link>
              </article>;
            })}</div> : <div className="border px-4 py-8 text-center text-sm" style={{ borderColor: "var(--line)", color: "var(--muted)", background: "var(--navy-800)", borderRadius: "var(--radius)" }}>{emptyLabel}</div>;

            if (upcomingGames.length && completedGames.length) return <><SectionHeading title={t("team_upcoming_games")} href="/games" linkLabel={t("team_all_games")} headingClassName="text-lg" />{renderGames(upcomingGames, t("team_no_upcoming"))}<h3 className="mb-4 mt-8 lbm-section-heading text-lg font-semibold uppercase leading-none">{t("team_recent_results")}</h3>{renderGames(completedGames, t("team_no_results"))}</>;
            if (upcomingGames.length) return <><SectionHeading title={t("team_upcoming_games")} href="/games" linkLabel={t("team_full_schedule")} headingClassName="text-lg" />{renderGames(upcomingGames, t("team_no_upcoming"))}</>;
            return <><SectionHeading title={t("team_recent_results")} href="/games" linkLabel={t("team_all_results")} headingClassName="text-lg" />{renderGames(completedGames, t("team_no_results"))}</>;
          })()}
        </section>

        {/* ROSTER */}
        <section>
          <SectionHeading title={`${t("team_roster")} · ${roster.length}`} href="/teams" linkLabel={t("teams_title")} headingClassName="text-lg" />
          <div className="overflow-hidden border" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}>
            {roster.length ? <div>{roster.map((p) => <Link key={p.player_id} href={`/players/${p.player_id}`} className="group flex min-h-14 items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--orange)]" style={{ borderColor: "var(--line)" }}>
              <PlayerAvatar playerId={p.player_id} playerName={`${p.first_name} ${p.last_name}`} photoUrl={p.photo_url} width={42} height={48} className="h-10 w-10 shrink-0 rounded-[var(--radius)] object-cover" />
              <span className="w-7 shrink-0 text-right text-sm font-semibold tabular-nums" style={{ color: "var(--muted)" }}>{p.jersey_number ?? "--"}</span>
              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold uppercase leading-tight group-hover:text-[var(--orange)]">{p.first_name} {p.last_name}</span>{p.position && <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{p.position}</span>}</span>
            </Link>)}</div> : <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>{t("team_no_roster")}</div>}
          </div>
        </section>
      </div>
      </div>
    </main>
  );
}