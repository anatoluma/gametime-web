"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useT } from "@/app/components/LanguageProvider";
import Crest from "@/app/components/home/Crest";
import SectionHeading from "@/app/components/home/SectionHeading";
import { getWinner } from "@/lib/get-winner";

type GameRow = {
  game_id: string;
  season: string | null;
  tipoff: string | null;
  scheduled_date: string | null;
  round_number: number | null;
  venue: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

type TeamRow = {
  team_id: string;
  team_name: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekendWindow(now: Date, offsetWeeks: 0 | -1) {
  const today = startOfDay(now);
  const day = today.getDay();
  const daysUntilSat = (6 - day + 7) % 7; 

  const upcomingSat = new Date(today);
  upcomingSat.setDate(upcomingSat.getDate() + daysUntilSat);

  const targetSat = new Date(upcomingSat);
  if (offsetWeeks === -1) targetSat.setDate(targetSat.getDate() - 7);

  const start = startOfDay(targetSat);
  const end = new Date(start);
  end.setDate(end.getDate() + 2); 

  return { start, end };
}

function inRange(iso: string | null, start: Date, end: Date) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export default function GamesPage() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [teamsById, setTeamsById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [selectedRound, setSelectedRound] = useState("all");
  const { t } = useT();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: teams } = await supabase.from("teams").select("team_id, team_name");
      if (cancelled) return;
      const map: Record<string, string> = {};
      ((teams ?? []) as TeamRow[]).forEach((t) => (map[t.team_id] = t.team_name));
      setTeamsById(map);

      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select("*")
        .order("tipoff", { ascending: false });

      if (cancelled) return;
      if (gamesError) { setError(gamesError); setLoading(false); return; }

      setGames((gamesData ?? []) as GameRow[]);
      const seasons = [...new Set((gamesData ?? []).map((game: GameRow) => game.season).filter(Boolean))] as string[];
      setSelectedSeason(seasons.sort().at(-1) ?? "");
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const computed = useMemo(() => {
    const now = new Date();
    const seasonGames = selectedSeason ? games.filter((g) => g.season === selectedSeason) : games;
    
    // helper to get the Monday of a given week
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      return startOfDay(new Date(date.setDate(diff)));
    };

    const thisMonday = getMonday(now);
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);
    
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);

    const isFinished = (g: GameRow) => {
      const gameDate = g.tipoff
        ? new Date(g.tipoff)
        : g.scheduled_date
          ? new Date(`${g.scheduled_date}T12:00:00`)
          : null;
      const now = new Date();
      return g.home_score != null && g.away_score != null && gameDate && gameDate < now;
    };
    
    // 1. Current Week Games (Today + Future this week)
    const upcomingThisWeek = seasonGames.filter(g =>
      inRange(g.tipoff, thisMonday, nextMonday) && !isFinished(g)
    ).sort((a, b) => (a.tipoff ? new Date(a.tipoff).getTime() : 0) - (b.tipoff ? new Date(b.tipoff).getTime() : 0));

    // 2. Today's Finished Games or Recent Results
    const recentResults = seasonGames.filter(g =>
      (inRange(g.tipoff, thisMonday, nextMonday) || inRange(g.tipoff, lastMonday, thisMonday)) && isFinished(g)
    ).sort((a, b) => (b.tipoff ? new Date(b.tipoff).getTime() : 0) - (a.tipoff ? new Date(a.tipoff).getTime() : 0));

    const allUpcoming = seasonGames.filter(g => !isFinished(g));
    const allFinished = seasonGames.filter(isFinished);
    const scheduleGames = seasonGames
      .filter((g) => selectedRound === "all" || String(g.round_number) === selectedRound)
      .sort((a, b) => (a.scheduled_date ?? a.tipoff ?? "").localeCompare(b.scheduled_date ?? b.tipoff ?? ""));
    const rounds = [...new Set(seasonGames.map((g) => g.round_number).filter((round): round is number => round != null))].sort((a, b) => a - b);

    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    return {
      upcomingThisWeek,
      recentResults,
      allUpcoming,
      allFinished,
      scheduleGames,
      rounds,
      thisWeekLabel: `${fmt(thisMonday)} — ${fmt(new Date(nextMonday.getTime() - 86400000))}`,
      lastWeekLabel: `${fmt(lastMonday)} — ${fmt(new Date(thisMonday.getTime() - 86400000))}`,
    };
  }, [games, selectedRound, selectedSeason]);

  const GameCard = ({ g }: { g: GameRow }) => {
    const dateObj = g.tipoff
      ? new Date(g.tipoff)
      : g.scheduled_date
        ? new Date(`${g.scheduled_date}T12:00:00`)
        : null;
    const now = new Date();
    const isFinished = g.home_score != null && g.away_score != null && dateObj && dateObj < now;
    const timeText = g.tipoff && dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Time TBD";
    const dateText = dateObj ? dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : "";

    const winner = getWinner(g.home_score, g.away_score);
    const homeName = teamsById[g.home_team_id] || g.home_team_id;
    const awayName = teamsById[g.away_team_id] || g.away_team_id;

    return (
      <Link
        href={`/games/${g.game_id}`}
        className="group block border px-3 py-3 transition-colors hover:border-[var(--orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)]"
        style={{
          borderColor: "var(--line)",
          borderRadius: "var(--radius)",
          background: "var(--navy-800)",
          borderLeft: "3px solid var(--orange)",
        }}
      >
        <div className="mb-2 flex items-center justify-between text-[11px]" style={{ color: "var(--muted)" }}>
          <div className="flex items-center gap-1.5">
            <span>{dateText}</span>
            <span>•</span>
            <span>{timeText}</span>
          </div>
          <span style={{ color: isFinished ? "var(--win)" : "var(--orange)" }}>
            {isFinished ? t("status_final") : t("status_scheduled")}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Crest teamId={g.home_team_id} teamName={homeName} size={26} />
              <span
                className={`truncate text-xs uppercase ${winner === "home" ? "font-bold" : "font-semibold"}`}
                style={{ color: winner === "home" ? "var(--text)" : "var(--lose)" }}
              >
                {homeName}
              </span>
            </div>
            {isFinished ? (
              <span
                className="text-right"
                style={{
                  color: winner === "home" ? "var(--orange)" : "var(--lose)",
                  fontFamily: "var(--font-display)",
                  fontSize: "17px",
                  fontWeight: winner === "home" ? 700 : 500,
                }}
              >
                {g.home_score}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Crest teamId={g.away_team_id} teamName={awayName} size={26} />
              <span
                className={`truncate text-xs uppercase ${winner === "away" ? "font-bold" : "font-semibold"}`}
                style={{ color: winner === "away" ? "var(--text)" : "var(--lose)" }}
              >
                {awayName}
              </span>
            </div>
            {isFinished ? (
              <span
                className="text-right"
                style={{
                  color: winner === "away" ? "var(--orange)" : "var(--lose)",
                  fontFamily: "var(--font-display)",
                  fontSize: "17px",
                  fontWeight: winner === "away" ? 700 : 500,
                }}
              >
                {g.away_score}
              </span>
            ) : (
              <span className="text-[10px] uppercase" style={{ color: "var(--muted)" }}>{g.venue || "TBD"}</span>
            )}
          </div>
        </div>
      </Link>
    );
  };

  if (loading) return <main className="p-8 max-w-2xl mx-auto text-2xl font-semibold" style={{ color: "var(--text)" }}>{t("games_loading")}</main>;

  return (
    <main className="min-h-screen px-3 pb-20 pt-4 sm:px-6" style={{ background: "var(--navy-950)", color: "var(--text)" }}>
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-5 text-3xl uppercase leading-none" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          {t("games_title")}
        </h1>

        <div className="mb-8 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
            Season
            <select value={selectedSeason} onChange={(event) => { setSelectedSeason(event.target.value); setSelectedRound("all"); }} className="rounded border px-3 py-2 text-xs" style={{ borderColor: "var(--line)", background: "var(--navy-800)", color: "var(--text)" }}>
              {[...new Set(games.map((game) => game.season).filter((season): season is string => Boolean(season)))].sort().reverse().map((season) => <option key={season} value={season}>{season}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase" style={{ color: "var(--muted)" }}>
            Round
            <select value={selectedRound} onChange={(event) => setSelectedRound(event.target.value)} className="rounded border px-3 py-2 text-xs" style={{ borderColor: "var(--line)", background: "var(--navy-800)", color: "var(--text)" }}>
              <option value="all">All rounds</option>
              {computed.rounds.map((round) => <option key={round} value={round}>Round {round}</option>)}
            </select>
          </label>
        </div>

        <section className="mb-10">
          <SectionHeading title={t("games_this_week")} href="/games" linkLabel={t("standings_full_schedule")} headingClassName="text-lg" />
          <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--orange)" }}>{computed.thisWeekLabel}</p>
          <div className="grid gap-3">
            {computed.upcomingThisWeek.map(g => <GameCard key={g.game_id} g={g} />)}
            {computed.upcomingThisWeek.length === 0 && (
              <p className="rounded border border-dashed p-4 text-center text-sm" style={{ borderColor: "var(--line)", background: "var(--navy-800)", color: "var(--muted)", borderRadius: "var(--radius)" }}>{t("games_no_upcoming")}</p>
            )}
          </div>
        </section>

        <section>
          <SectionHeading title={t("games_recent")} href="/games" linkLabel={t("home_cta_results")} headingClassName="text-lg" />
          <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{t("games_recent_sub")}</p>
          <div className="grid gap-3">
            {computed.recentResults.slice(0, 6).map(g => <GameCard key={g.game_id} g={g} />)}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="lbm-section-heading text-lg font-semibold uppercase leading-none">Full schedule</h2>
          <div className="mt-4 space-y-8">
            {computed.rounds
              .filter((round) => selectedRound === "all" || String(round) === selectedRound)
              .map((round) => (
                <div key={round}>
                  <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--orange)" }}>Round {round}</h2>
                  <div className="grid gap-3">
                    {computed.scheduleGames.filter((game) => game.round_number === round).map((game) => <GameCard key={game.game_id} g={game} />)}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}
