"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Team = {
  team_id: string;
  team_name: string;
  city: string | null;
  coach: string | null;
};

type Player = {
  player_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
};

type Game = {
  game_id: string;
  season: string | null;
  tipoff: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

type Summary = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  diff: number;
};

type TeamMap = Record<string, string>;

export default function TeamPage() {
  const params = useParams();

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

      // Load team name map (for games list)
      const { data: allTeams, error: allTeamsError } = await supabase
        .from("teams")
        .select("team_id, team_name");

      if (cancelled) return;

      if (allTeamsError) {
        setError(allTeamsError);
        setLoading(false);
        return;
      }

      const map: TeamMap = {};
      (allTeams ?? []).forEach((t: any) => (map[t.team_id] = t.team_name));
      setTeamsById(map);

      // 1) Load team
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("team_id, team_name, city, coach")
        .eq("team_id", teamId)
        .maybeSingle();

      if (cancelled) return;

      if (teamError) {
        setError(teamError);
        setLoading(false);
        return;
      }

      if (!teamData) {
        setTeam(null);
        setRoster([]);
        setSummary(null);
        setGames([]);
        setLoading(false);
        return;
      }

      setTeam(teamData as Team);

      // 2) Load roster
      const { data: rosterData, error: rosterError } = await supabase
        .from("players")
        .select("player_id, first_name, last_name, jersey_number")
        .eq("team_id", teamId)
        .order("last_name", { ascending: true });

      if (cancelled) return;

      if (rosterError) {
        setError(rosterError);
        setLoading(false);
        return;
      }

      setRoster((rosterData ?? []) as Player[]);

      // 3) Load games for record + game list
      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select("game_id, season, tipoff, home_team_id, away_team_id, home_score, away_score")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order("tipoff", { ascending: false });

      if (cancelled) return;

      if (gamesError) {
        setError(gamesError);
        setLoading(false);
        return;
      }

      const allGames = (gamesData ?? []) as Game[];
      setGames(allGames);

      // record only from finished games
      const finishedGames = allGames.filter(
        (g) => g.home_score != null && g.away_score != null
      );

      let wins = 0;
      let losses = 0;
      let pf = 0;
      let pa = 0;

      for (const g of finishedGames) {
        const isHome = g.home_team_id === teamId;
        const scored = isHome ? (g.home_score ?? 0) : (g.away_score ?? 0);
        const conceded = isHome ? (g.away_score ?? 0) : (g.home_score ?? 0);

        pf += scored;
        pa += conceded;

        if (scored > conceded) wins += 1;
        else losses += 1;
      }

      setSummary({
        gamesPlayed: finishedGames.length,
        wins,
        losses,
        pf,
        pa,
        diff: pf - pa,
      });

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (!teamId) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Bad route</h1>
        <p className="mt-2 text-gray-600">Open /teams/&lt;team_id&gt;.</p>
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

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Error</h1>
        <pre className="mt-4 text-sm">{JSON.stringify(error, null, 2)}</pre>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Team not found</h1>
        <p className="mt-2 text-gray-600">
          No team with team_id = <code>{teamId}</code>
        </p>
      </main>
    );
  }

  const teamName = team.team_name;

  const matchText = (g: Game) => {
    const home = teamsById[g.home_team_id] ?? g.home_team_id;
    const away = teamsById[g.away_team_id] ?? g.away_team_id;
    return `${home} vs ${away}`;
  };

  const scoreText = (g: Game) => {
    if (g.home_score == null || g.away_score == null) return "—";
    return `${g.home_score} - ${g.away_score}`;
  };

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">{teamName}</h1>

      <div className="text-sm text-gray-600 mt-2">
        {team.city ? `City: ${team.city}` : null}
        {team.city && team.coach ? " • " : null}
        {team.coach ? `Coach: ${team.coach}` : null}
        <span className="text-gray-400">{" • "}</span>
        <span className="text-gray-500">team_id: {team.team_id}</span>
      </div>

      {summary && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-600">Record</div>
            <div className="text-xl font-bold">
              {summary.wins}-{summary.losses}
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-600">GP</div>
            <div className="text-xl font-bold">{summary.gamesPlayed}</div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-600">PF</div>
            <div className="text-xl font-bold">{summary.pf}</div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-600">PA</div>
            <div className="text-xl font-bold">{summary.pa}</div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="text-xs text-gray-600">DIFF</div>
            <div className="text-xl font-bold">{summary.diff}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
        {/* Recent games */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Recent games</h2>

          <div className="space-y-3">
            {games.slice(0, 10).map((g) => (
              <Link
                key={g.game_id}
                href={`/games/${g.game_id}`}
                className="block border rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="text-sm text-gray-600">
                  {g.tipoff ? new Date(g.tipoff).toLocaleString() : "TBD"}
                  {g.season ? ` • ${g.season}` : ""}
                </div>

                <div className="mt-2 flex items-center justify-between gap-4">
                  <div className="font-semibold">{matchText(g)}</div>
                  <div className="font-bold">{scoreText(g)}</div>
                </div>

                <div className="mt-1 text-xs text-gray-500">game_id: {g.game_id}</div>
              </Link>
            ))}

            {games.length === 0 && (
              <div className="text-gray-600">No games found for this team.</div>
            )}
          </div>
        </section>

        {/* Roster */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Roster</h2>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 w-24">#</th>
                  <th className="p-3">Player</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => (
                  <tr key={p.player_id} className="border-t">
                    <td className="p-3">{p.jersey_number ?? "-"}</td>
                    <td className="p-3">
                      <Link
                        href={`/players/${p.player_id}`}
                        className="hover:underline cursor-pointer"
                      >
                        {p.first_name} {p.last_name}
                      </Link>
                    </td>
                  </tr>
                ))}

                {roster.length === 0 && (
                  <tr className="border-t">
                    <td className="p-3" colSpan={2}>
                      No players found for this team.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
