import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type TeamRow = {
  team_id: string;
  name: string;
  gp: number;
  w: number;
  l: number;
  pts: number;
  pf: number; // points for
  pa: number; // points against
  diff: number;
};

export default async function StandingsPage() {
  // Finished games only (scores present)
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("home_team_id, away_team_id, home_score, away_score")
    .not("home_score", "is", null)
    .not("away_score", "is", null);

  if (gamesError) {
    return <pre className="p-6">{JSON.stringify(gamesError, null, 2)}</pre>;
  }

  // Active teams only (matches your site logic)
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("team_id, team_name")
    .eq("is_active", true)
    .order("team_name");

  if (teamsError) {
    return <pre className="p-6">{JSON.stringify(teamsError, null, 2)}</pre>;
  }

  const table: Record<string, TeamRow> = {};

  for (const t of teams ?? []) {
    table[t.team_id] = {
      team_id: t.team_id,
      name: t.team_name,
      gp: 0,
      w: 0,
      l: 0,
      pts: 0,
      pf: 0,
      pa: 0,
      diff: 0,
    };
  }

  for (const g of games ?? []) {
    const hs = Number(g.home_score);
    const as = Number(g.away_score);

    // Safety: skip weird rows
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;

    const home = table[g.home_team_id];
    const away = table[g.away_team_id];
    if (!home || !away) continue; // ignores inactive teams in finished games

    home.gp += 1;
    away.gp += 1;

    home.pf += hs;
    home.pa += as;

    away.pf += as;
    away.pa += hs;

    if (hs > as) {
      home.w += 1;
      away.l += 1;
      home.pts += 2;
      away.pts += 1;
    } else if (as > hs) {
      away.w += 1;
      home.l += 1;
      away.pts += 2;
      home.pts += 1;
    } else {
      // If draws can’t happen in your league, this is just safety.
      home.pts += 1;
      away.pts += 1;
    }
  }

  // finalize diff
  for (const k of Object.keys(table)) {
    table[k].diff = table[k].pf - table[k].pa;
  }

  // Sort: PTS desc, then diff desc, then PF desc, then name asc
  const sorted = Object.values(table).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.pf !== a.pf) return b.pf - a.pf;
    return a.name.localeCompare(b.name);
  });

  return (
    <main className="p-6">
      <div className="flex items-end justify-between mb-4">
        <h1 className="text-2xl font-bold">Standings</h1>
        <Link href="/games" className="text-sm underline">
          Games
        </Link>
      </div>

      <div className="border rounded-lg overflow-x-auto lg:overflow-x-visible">
        <table className="w-full min-w-[720px] lg:min-w-0 ...">
          <thead className="sticky top-0">
            <tr className="border-b">
              <th className="py-3 px-3">#</th>
              <th className="py-3 px-3">Team</th>
              <th className="py-3 px-3">GP</th>
              <th className="py-3 px-3">W</th>
              <th className="py-3 px-3">L</th>
              <th className="py-3 px-3">PTS</th>
              <th className="py-3 px-3">PF</th>
              <th className="py-3 px-3">PA</th>
              <th className="py-3 px-3">Diff</th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((t, idx) => (
              <tr key={t.name} className="border-b">
                <td className="py-3 px-3">{idx + 1}</td>
                <td className="py-3 px-3 font-medium">
                  <Link
                    href={`/teams/${t.team_id}`}
                    className="hover:underline underline-offset-2"
                  >
                    {t.name}
                  </Link>
                </td>
                <td className="py-3 px-3">{t.gp}</td>
                <td className="py-3 px-3">{t.w}</td>
                <td className="py-3 px-3">{t.l}</td>
                <td className="py-3 px-3 font-semibold">{t.pts}</td>
                <td className="py-3 px-3">{t.pf}</td>
                <td className="py-3 px-3">{t.pa}</td>
                <td className="py-3 px-3">{t.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs opacity-70 mt-3">
        Scoring: Win = 2 pts, Loss = 1 pt. Tie-breakers: PTS → Diff → PF.
      </p>
    </main>
  );
}