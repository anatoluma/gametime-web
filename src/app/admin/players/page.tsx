"use client";

import { useEffect, useState } from "react";

type Season = { season: string; is_current: boolean };

type PlayerSeasonRow = {
  player_id: string;
  season: string;
  team_id: string;
  jersey_number: number | null;
  is_active: boolean;
  players: { first_name: string | null; last_name: string | null } | null;
  teams: { team_name: string | null } | null;
};

export default function AdminPlayersPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [rows, setRows] = useState<PlayerSeasonRow[]>([]);
  const [teams, setTeams] = useState<Array<{ team_id: string; team_name: string | null; is_active: boolean | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Load seasons on mount
  useEffect(() => {
    fetch("/api/admin/seasons")
      .then((r) => r.json())
      .then(({ seasons: s }: { seasons: Season[] }) => {
        setSeasons(s ?? []);
        const current = s?.find((x: Season) => x.is_current)?.season ?? s?.[0]?.season ?? "";
        setSelectedSeason(current);
      });
  }, []);

  useEffect(() => {
    fetch("/api/admin/teams")
      .then((r) => r.json())
      .then(({ teams: t }) => setTeams(t ?? []));
  }, []);

  // Load roster when season changes
  useEffect(() => {
    if (!selectedSeason) return;
    setLoading(true);
    setRows([]);
    fetch(`/api/admin/players/seasons?season=${encodeURIComponent(selectedSeason)}`)
      .then((r) => r.json())
      .then(({ player_seasons }) => {
        setRows(player_seasons ?? []);
        setLoading(false);
      });
  }, [selectedSeason]);

  const handleSetCurrent = async (season: string) => {
    const res = await fetch(`/api/admin/seasons/${encodeURIComponent(season)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_current: true }),
    });
    if (res.ok) {
      setSeasons((prev) => prev.map((s) => ({ ...s, is_current: s.season === season })));
      setMessage(`✓ ${season} is now the current season`);
    } else {
      const { error } = await res.json();
      setMessage(`Error: ${error}`);
    }
  };

  const handleCopySeason = async () => {
    const seasonList = seasons.map((s) => s.season).sort();
    const currentIdx = seasonList.indexOf(selectedSeason);
    const target = seasonList[currentIdx + 1] ?? "";
    if (!target) {
      setMessage("No next season found. Create one first via the API.");
      return;
    }
    if (!confirm(`Copy all ${rows.length} players from ${selectedSeason} → ${target}?`)) return;
    const res = await fetch("/api/admin/players/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "copy_season", source_season: selectedSeason, target_season: target }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage(`✓ Copied ${json.copied} players to ${target}`);
    } else {
      setMessage(`Error: ${json.error}`);
    }
  };

  const handleToggleActive = async (row: PlayerSeasonRow) => {
    const isCurrentSeason = !!seasons.find((s) => s.season === selectedSeason)?.is_current;
    if (!isCurrentSeason) {
      setMessage("Only the current season can be edited.");
      return;
    }

    const res = await fetch("/api/admin/players/seasons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: row.player_id, season: row.season, is_active: !row.is_active }),
    });
    if (res.ok) {
      setRows((prev) =>
        prev.map((r) =>
          r.player_id === row.player_id ? { ...r, is_active: !r.is_active } : r
        )
      );
      setMessage(`✓ Updated ${row.players?.first_name ?? "Player"} ${row.players?.last_name ?? ""}`);
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error ?? "Unable to update player status"}`);
    }
  };

  const handleMovePlayer = async (row: PlayerSeasonRow, nextTeamId: string) => {
    const isCurrentSeason = !!seasons.find((s) => s.season === selectedSeason)?.is_current;
    if (!isCurrentSeason) {
      setMessage("Only the current season can be edited.");
      return;
    }

    const res = await fetch("/api/admin/players/seasons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_id: row.player_id, season: row.season, team_id: nextTeamId }),
    });

    if (res.ok) {
      setRows((prev) =>
        prev.map((r) => (r.player_id === row.player_id ? { ...r, team_id: nextTeamId, teams: { team_name: teams.find((t) => t.team_id === nextTeamId)?.team_name ?? nextTeamId } } : r))
      );
      setMessage(`✓ Moved ${row.players?.first_name ?? "Player"} ${row.players?.last_name ?? ""} to ${nextTeamId}`);
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error ?? "Unable to move player"}`);
    }
  };

  const grouped = rows.reduce<Record<string, PlayerSeasonRow[]>>((acc, r) => {
    const key = r.teams?.team_name ?? r.team_id;
    (acc[key] ??= []).push(r);
    return acc;
  }, {});

  const isCurrentSeason = !!seasons.find((s) => s.season === selectedSeason)?.is_current;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Season Rosters</h1>
        <a
          href="/admin/teams"
          className="text-sm px-3 py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-muted)]"
        >
          Manage teams
        </a>
      </div>

      {!isCurrentSeason && (
        <div className="mb-6 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This season is read-only. Switch to the current season to edit roster membership.
        </div>
      )}

      {/* Season controls */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--surface)]"
        >
          {seasons.map((s) => (
            <option key={s.season} value={s.season}>
              {s.season}{s.is_current ? " (current)" : ""}
            </option>
          ))}
        </select>

        {selectedSeason && !seasons.find((s) => s.season === selectedSeason)?.is_current && (
          <button
            onClick={() => handleSetCurrent(selectedSeason)}
            className="text-sm px-4 py-2 rounded border border-orange-500 text-orange-600 hover:bg-orange-50"
          >
            Set as current season
          </button>
        )}

        <button
          onClick={handleCopySeason}
          disabled={!selectedSeason || !isCurrentSeason || rows.length === 0}
          className="text-sm px-4 py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-muted)] disabled:opacity-40"
        >
          Copy roster to next season →
        </button>
      </div>

      {message && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          {message}
        </p>
      )}

      {loading && <p className="text-sm text-gray-400 animate-pulse">Loading roster...</p>}

      {!loading && rows.length === 0 && selectedSeason && (
        <p className="text-sm text-gray-400">No players registered for {selectedSeason}.</p>
      )}

      {/* Roster grouped by team */}
      {Object.entries(grouped).map(([teamName, players]) => (
        <div key={teamName} className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2 border-b border-[var(--border)] pb-1">
            {teamName}
          </h2>
          <div className="divide-y divide-[var(--border)]">
            {players.map((p) => (
              <div
                key={p.player_id}
                className={`flex items-center justify-between py-2.5 px-1 gap-2 ${!p.is_active ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-gray-400 w-6 text-right shrink-0">
                    #{p.jersey_number ?? "—"}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {p.players?.first_name} {p.players?.last_name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isCurrentSeason && (
                    <select
                      value={p.team_id}
                      onChange={(e) => handleMovePlayer(p, e.target.value)}
                      className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
                    >
                      {teams.map((team) => (
                        <option key={team.team_id} value={team.team_id}>
                          {team.team_name ?? team.team_id}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={() => handleToggleActive(p)}
                    disabled={!isCurrentSeason}
                    className={`text-xs px-2.5 py-1 rounded border ${
                      p.is_active
                        ? "border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500"
                        : "border-green-300 text-green-600 hover:bg-green-50"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {p.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
