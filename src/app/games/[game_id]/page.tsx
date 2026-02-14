"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Game = {
  game_id: string;
  season: string | null;
  tipoff: string | null;
  venue: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

type Team = {
  team_id: string;
  team_name: string;
};

type PlayerStat = {
  player_id: string;
  team_id: string;
  points: number | null;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number | null;
};

type DataIssue = {
  level: "warn" | "error";
  message: string;
};

export default function GamePage() {
  const params = useParams();

  const gameId = useMemo(() => {
    const raw = (params as any)?.game_id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [issues, setIssues] = useState<DataIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!gameId) return;

      setLoading(true);
      setError(null);
      setIssues([]);

      // 1) Load game
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("game_id", gameId)
        .maybeSingle();

      if (cancelled) return;

      if (gameError || !gameData) {
        setError(gameError ?? { message: "Game not found" });
        setLoading(false);
        return;
      }

      setGame(gameData as Game);

      // 2) Load teams
      const { data: teamsData } = await supabase
        .from("teams")
        .select("team_id, team_name");

      const teamMap: Record<string, Team> = {};
      (teamsData ?? []).forEach((t: Team) => {
        teamMap[t.team_id] = t;
      });
      setTeams(teamMap);

      // 3) Load player stats + player info
      const { data: statsData, error: statsError } = await supabase
        .from("player_game_stats")
        .select(
          `
          player_id,
          team_id,
          points,
          players (
            first_name,
            last_name,
            jersey_number
          )
        `
        )
        .eq("game_id", gameId);

      if (cancelled) return;

      if (statsError) {
        setError(statsError);
        setLoading(false);
        return;
      }

      const normalized: PlayerStat[] = (statsData ?? []).map((s: any) => ({
        player_id: s.player_id,
        team_id: s.team_id,
        points: s.points,
        first_name: s.players?.first_name ?? null,
        last_name: s.players?.last_name ?? null,
        jersey_number: s.players?.jersey_number ?? null,
      }));

      // 4) Integrity checks (admin-facing)
      const newIssues: DataIssue[] = [];

      const homeId = (gameData as Game).home_team_id;
      const awayId = (gameData as Game).away_team_id;

      // A) Stat rows with team_id not part of this game
      const badTeamRows = normalized.filter(
        (r) => r.team_id !== homeId && r.team_id !== awayId
      );
      if (badTeamRows.length > 0) {
        newIssues.push({
          level: "error",
          message: `${badTeamRows.length} stat row(s) have team_id not in this game (${homeId}/${awayId}).`,
        });
      }

      // B) Duplicate player entries in same game
      const counts = new Map<string, number>();
      for (const r of normalized) {
        counts.set(r.player_id, (counts.get(r.player_id) ?? 0) + 1);
      }
      const dupes = Array.from(counts.entries())
        .filter(([, c]) => c > 1)
        .map(([pid, c]) => `${pid}×${c}`);
      if (dupes.length > 0) {
        newIssues.push({
          level: "error",
          message: `Duplicate player entries in this game: ${dupes.join(", ")}.`,
        });
      }

      // C) Score mismatch (only if final score exists)
      const sumPts = (teamId: string) =>
        normalized
          .filter((r) => r.team_id === teamId)
          .reduce((s, r) => s + (r.points ?? 0), 0);

      const homeBox = sumPts(homeId);
      const awayBox = sumPts(awayId);

      const homeFinal = (gameData as Game).home_score;
      const awayFinal = (gameData as Game).away_score;

      if (homeFinal != null && awayFinal != null) {
        if (homeBox !== homeFinal) {
          newIssues.push({
            level: "warn",
            message: `Home boxscore total = ${homeBox}, but final score = ${homeFinal}.`,
          });
        }
        if (awayBox !== awayFinal) {
          newIssues.push({
            level: "warn",
            message: `Away boxscore total = ${awayBox}, but final score = ${awayFinal}.`,
          });
        }
      }

      setIssues(newIssues);

      setStats(normalized);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (!gameId) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Bad route</h1>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Loading…</h1>
      </main>
    );
  }

  if (error || !game) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Error</h1>
        <pre className="mt-4 text-sm">{JSON.stringify(error, null, 2)}</pre>
      </main>
    );
  }

  const homeTeam = teams[game.home_team_id];
  const awayTeam = teams[game.away_team_id];

  const homeStats = stats.filter((s) => s.team_id === game.home_team_id);
  const awayStats = stats.filter((s) => s.team_id === game.away_team_id);

  const renderTable = (rows: PlayerStat[]) => (
    <table className="w-full text-left border mt-2">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-2 w-16">#</th>
          <th className="p-2">Player</th>
          <th className="p-2 w-20 text-right">PTS</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.player_id} className="border-t">
            <td className="p-2">{p.jersey_number ?? "-"}</td>
            <td className="p-2">
              <Link href={`/players/${p.player_id}`} className="hover:underline">
                {p.first_name} {p.last_name}
              </Link>
            </td>
            <td className="p-2 text-right font-semibold">{p.points ?? 0}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr className="border-t">
            <td colSpan={3} className="p-2 text-gray-600">
              No stats.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">
        <Link href={`/teams/${game.home_team_id}`} className="hover:underline">
          {homeTeam?.team_name ?? "Unknown team"}
        </Link>{" "}
        vs{" "}
        <Link href={`/teams/${game.away_team_id}`} className="hover:underline">
          {awayTeam?.team_name ?? "Unknown team"}
        </Link>
      </h1>

      <div className="mt-2 text-gray-600">
        {game.tipoff ? new Date(game.tipoff).toLocaleString() : "TBD"}
        {game.venue ? ` • ${game.venue}` : ""}
        {game.season ? ` • ${game.season}` : ""}
      </div>

      {issues.length > 0 && (
        <div className="mt-4 border rounded-lg p-4 bg-yellow-50">
          <div className="font-bold">⚠️ Data issues detected</div>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            {issues.map((i, idx) => (
              <li key={idx} className={i.level === "error" ? "font-semibold" : ""}>
                {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 text-2xl font-bold">
        {game.home_score ?? "-"} : {game.away_score ?? "-"}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
        <div>
          <h2 className="text-xl font-semibold">
            {homeTeam?.team_name ?? game.home_team_id}
          </h2>
          {renderTable(homeStats)}
        </div>

        <div>
          <h2 className="text-xl font-semibold">
            {awayTeam?.team_name ?? game.away_team_id}
          </h2>
          {renderTable(awayStats)}
        </div>
      </div>
    </main>
  );
}
