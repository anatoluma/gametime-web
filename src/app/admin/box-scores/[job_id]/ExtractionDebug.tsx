"use client";

import { useState } from "react";

type Player = {
  team_code?: string | null;
  number?: number | null;
  name?: string | null;
  dnp?: boolean | null;
  stats?: Record<string, unknown> | null;
};

type Props = {
  extractionJson: Record<string, unknown> | null;
  imageUrl: string | null;
};

const STAT_COLS = [
  "min", "fg_made", "fg_att", "two_made", "two_att", "three_made", "three_att",
  "ft_made", "ft_att", "reb_off", "reb_def", "reb_tot", "assists", "turnovers",
  "steals", "blocks", "fouls_personal", "fouls_drawn", "plus_minus", "efficiency", "points",
] as const;

const SHORT: Record<string, string> = {
  min: "Min", fg_made: "FGM", fg_att: "FGA", two_made: "2M", two_att: "2A",
  three_made: "3M", three_att: "3A", ft_made: "FTM", ft_att: "FTA",
  reb_off: "OR", reb_def: "DR", reb_tot: "TOT", assists: "AS", turnovers: "TO",
  steals: "ST", blocks: "BS", fouls_personal: "PF", fouls_drawn: "FD",
  plus_minus: "+/-", efficiency: "EF", points: "PTS",
};

export default function ExtractionDebug({ extractionJson, imageUrl }: Props) {
  const [showImage, setShowImage] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const players = (extractionJson?.players ?? []) as Player[];
  const teams = [
    (extractionJson?.home_team as { code?: string } | null)?.code,
    (extractionJson?.away_team as { code?: string } | null)?.code,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3 mb-6">
      {/* Image preview */}
      {imageUrl && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowImage((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium hover:bg-[var(--surface-muted)] transition-colors"
          >
            <span>Box score image</span>
            <span className="text-[var(--text-muted)]">{showImage ? "▲" : "▼"}</span>
          </button>
          {showImage && (
            <div className="px-6 pb-6">
              <img
                src={imageUrl}
                alt="Box score"
                className="w-full rounded border border-[var(--border)] object-contain max-h-[600px]"
              />
            </div>
          )}
        </section>
      )}

      {/* Player stats table */}
      {players.length > 0 && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium hover:bg-[var(--surface-muted)] transition-colors"
          >
            <span>Extracted player stats ({players.length} players)</span>
            <span className="text-[var(--text-muted)]">{showTable ? "▲" : "▼"}</span>
          </button>
          {showTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-[var(--surface-muted)] border-y border-[var(--border)]">
                    <th className="px-3 py-2 text-left font-medium sticky left-0 bg-[var(--surface-muted)]">Team</th>
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium min-w-[120px]">Name</th>
                    {STAT_COLS.map((col) => (
                      <th key={col} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                        {SHORT[col]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => {
                    const teamPlayers = players.filter((p) => p.team_code === team);
                    return teamPlayers.map((p, i) => {
                      const stats = p.stats ?? {};
                      const hasPts = typeof stats.points === "number";
                      return (
                        <tr
                          key={`${team}-${i}`}
                          className={`border-b border-[var(--border)] ${p.dnp ? "opacity-40" : ""} ${!hasPts && !p.dnp ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                        >
                          <td className="px-3 py-1.5 sticky left-0 bg-[var(--surface)] font-semibold">{p.team_code}</td>
                          <td className="px-3 py-1.5 text-right">{p.number ?? "—"}</td>
                          <td className="px-3 py-1.5 min-w-[120px]">{p.name ?? "—"}{p.dnp ? " (DNP)" : ""}</td>
                          {STAT_COLS.map((col) => {
                            const val = stats[col];
                            const isNull = val === null || val === undefined;
                            return (
                              <td
                                key={col}
                                className={`px-2 py-1.5 text-center ${isNull && !p.dnp ? "text-red-500 dark:text-red-400" : "text-[var(--foreground)]"}`}
                              >
                                {isNull ? "—" : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Raw JSON */}
      {extractionJson && (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium hover:bg-[var(--surface-muted)] transition-colors"
          >
            <span>Raw extraction JSON</span>
            <span className="text-[var(--text-muted)]">{showRaw ? "▲" : "▼"}</span>
          </button>
          {showRaw && (
            <pre className="px-6 py-4 text-xs overflow-x-auto text-[var(--foreground)] bg-[var(--surface-muted)] max-h-[500px] overflow-y-auto">
              {JSON.stringify(extractionJson, null, 2)}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}
