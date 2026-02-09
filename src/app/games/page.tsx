"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type GameRow = {
  game_id: string;
  season: string | null;
  tipoff: string | null;
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

/**
 * Weekend window: Saturday 00:00 -> Monday 00:00
 * offsetWeeks = 0 => upcoming weekend
 * offsetWeeks = -1 => last weekend
 */
function weekendWindow(now: Date, offsetWeeks: 0 | -1) {
  const today = startOfDay(now);
  // JS getDay(): Sun=0 ... Sat=6
  const day = today.getDay();
  const daysUntilSat = (6 - day + 7) % 7; // 0 if Saturday

  const upcomingSat = new Date(today);
  upcomingSat.setDate(upcomingSat.getDate() + daysUntilSat);

  const targetSat = new Date(upcomingSat);
  if (offsetWeeks === -1) targetSat.setDate(targetSat.getDate() - 7);

  const start = startOfDay(targetSat);
  const end = new Date(start);
  end.setDate(end.getDate() + 2); // Monday 00:00

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
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // Teams map
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("team_id, team_name");

      if (cancelled) return;

      if (teamsError) {
        setError(teamsError);
        setLoading(false);
        return;
      }

      const map: Record<string, string> = {};
      (teams ?? []).forEach((t: TeamRow) => (map[t.team_id] = t.team_name));
      setTeamsById(map);

      // Games
      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select(
          "game_id, season, tipoff, venue, home_team_id, away_team_id, home_score, away_score"
        )
        .order("tipoff", { ascending: false });

      if (cancelled) return;

      if (gamesError) {
        setError(gamesError);
        setLoading(false);
        return;
      }

      setGames((gamesData ?? []) as GameRow[]);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const computed = useMemo(() => {
    const now = new Date();
    const upcomingWknd = weekendWindow(now, 0);
    const lastWknd = weekendWindow(now, -1);

    const isFinished = (g: GameRow) =>
      g.home_score != null && g.away_score != null;
    const isUpcoming = (g: GameRow) => !isFinished(g);

    const allUpcoming = games
      .filter(isUpcoming)
      .sort((a, b) => {
        const ta = a.tipoff ? new Date(a.tipoff).getTime() : Infinity;
        const tb = b.tipoff ? new Date(b.tipoff).getTime() : Infinity;
        return ta - tb; // soonest first
      });

    const allFinished = games
      .filter(isFinished)
      .sort((a, b) => {
        const ta = a.tipoff ? new Date(a.tipoff).getTime() : -Infinity;
        const tb = b.tipoff ? new Date(b.tipoff).getTime() : -Infinity;
        return tb - ta; // newest first
      });

    const upcomingWeekend = allUpcoming.filter((g) =>
      inRange(g.tipoff, upcomingWknd.start, upcomingWknd.end)
    );

    const finishedLastWeekend = allFinished.filter((g) =>
      inRange(g.tipoff, lastWknd.start, lastWknd.end)
    );

    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    const windowLabel = (start: Date, end: Date) =>
      `${fmt(start)} — ${fmt(new Date(end.getTime() - 1))}`;

    return {
      upcomingWknd,
      lastWknd,
      upcomingWeekend,
      finishedLastWeekend,
      allUpcoming,
      allFinished,
      windowLabel,
    };
  }, [games]);

  const card = (g: GameRow) => {
    const homeName = teamsById[g.home_team_id] ?? g.home_team_id;
    const awayName = teamsById[g.away_team_id] ?? g.away_team_id;

    const dateText = g.tipoff ? new Date(g.tipoff).toLocaleString() : "TBD";
    const scoreText =
      g.home_score != null && g.away_score != null
        ? `${g.home_score} - ${g.away_score}`
        : "—";

    return (
      <Link
        key={g.game_id}
        href={`/games/${g.game_id}`}
        className="block border rounded-lg p-4 hover:bg-gray-50"
      >
        <div className="text-sm text-gray-600">
          {g.season ?? ""}
          {g.season ? " • " : ""}
          {dateText}
          {g.venue ? ` • ${g.venue}` : ""}
        </div>

        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="font-semibold">
            {homeName} <span className="text-gray-500">vs</span> {awayName}
          </div>
          <div className="font-bold">{scoreText}</div>
        </div>
      </Link>
    );
  };

  if (loading) {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-bold">Games</h1>
        <p className="mt-2 text-gray-600">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-bold">Games</h1>
        <pre className="mt-4 text-sm">{JSON.stringify(error, null, 2)}</pre>
      </main>
    );
  }

  const {
    upcomingWeekend,
    finishedLastWeekend,
    allUpcoming,
    allFinished,
    windowLabel,
    upcomingWknd,
    lastWknd,
  } = computed;

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Games</h1>

      {/* Upcoming Weekend */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Upcoming weekend</h2>
            <div className="text-sm text-gray-600 mt-1">
              {windowLabel(upcomingWknd.start, upcomingWknd.end)}
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Showing: <span className="font-semibold">{upcomingWeekend.length}</span>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {upcomingWeekend.map(card)}
          {upcomingWeekend.length === 0 && (
            <div className="text-gray-600">No upcoming weekend games found.</div>
          )}
        </div>

        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            Show all upcoming ({allUpcoming.length})
          </summary>
          <div className="space-y-3 mt-3">{allUpcoming.map(card)}</div>
          {allUpcoming.length === 0 && (
            <div className="text-gray-600 mt-3">No upcoming games.</div>
          )}
        </details>
      </section>

      {/* Finished Last Weekend */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold">Finished last weekend</h2>
            <div className="text-sm text-gray-600 mt-1">
              {windowLabel(lastWknd.start, lastWknd.end)}
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Showing:{" "}
            <span className="font-semibold">{finishedLastWeekend.length}</span>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {finishedLastWeekend.map(card)}
          {finishedLastWeekend.length === 0 && (
            <div className="text-gray-600">
              No finished games found for last weekend.
            </div>
          )}
        </div>

        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            Show all finished ({allFinished.length})
          </summary>
          <div className="space-y-3 mt-3">{allFinished.map(card)}</div>
          {allFinished.length === 0 && (
            <div className="text-gray-600 mt-3">No finished games.</div>
          )}
        </details>
      </section>
    </main>
  );
}
