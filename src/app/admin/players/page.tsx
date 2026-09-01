"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Season = { season: string; is_current: boolean };

type Team = { team_id: string; team_name: string | null; is_active: boolean | null };

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
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [rows, setRows] = useState<PlayerSeasonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [addPlayerForm, setAddPlayerForm] = useState({
    first_name: "",
    last_name: "",
    jersey_number: "",
  });

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
      .then(({ teams: t }) => {
        const list = t ?? [];
        setTeams(list);
        if (!selectedTeamId && list.length > 0) {
          setSelectedTeamId(list.find((team) => team.is_active)?.team_id ?? list[0].team_id);
        }
      });
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedSeason) return;

    let isMounted = true;

    const loadRoster = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/players/seasons?season=${encodeURIComponent(selectedSeason)}`);
        const json = await response.json();

        if (!isMounted) return;

        setRows(json.player_seasons ?? []);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadRoster();

    return () => {
      isMounted = false;
    };
  }, [selectedSeason]);

  const isCurrentSeason = useMemo(
    () => !!seasons.find((season) => season.season === selectedSeason)?.is_current,
    [seasons, selectedSeason]
  );

  const teamRoster = useMemo(
    () => rows.filter((row) => row.team_id === selectedTeamId),
    [rows, selectedTeamId]
  );

  const handleSetCurrent = async (season: string) => {
    const res = await fetch(`/api/admin/seasons/${encodeURIComponent(season)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_current: true }),
    });

    if (res.ok) {
      setSeasons((prev) => prev.map((s) => ({ ...s, is_current: s.season === season })));
      setSelectedSeason(season);
      setMessage(`✓ ${season} is now the current season`);
    } else {
      const { error } = await res.json();
      setMessage(`Error: ${error}`);
    }
  };

  const handleToggleActive = async (row: PlayerSeasonRow) => {
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
        prev.map((r) => (r.player_id === row.player_id ? { ...r, is_active: !r.is_active } : r))
      );
      setMessage(`✓ Updated ${row.players?.first_name ?? "Player"} ${row.players?.last_name ?? ""}`);
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error ?? "Unable to update player status"}`);
    }
  };

  const handleMovePlayer = async (row: PlayerSeasonRow, nextTeamId: string) => {
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
        prev.map((r) =>
          r.player_id === row.player_id ? { ...r, team_id: nextTeamId, teams: { team_name: teams.find((team) => team.team_id === nextTeamId)?.team_name ?? nextTeamId } } : r
        )
      );
      setMessage(`✓ Moved ${row.players?.first_name ?? "Player"} ${row.players?.last_name ?? ""} to ${nextTeamId}`);
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error ?? "Unable to move player"}`);
    }
  };

  const handleAddPlayer = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedTeamId || !isCurrentSeason) {
      setMessage("Select a current-season team before adding a player.");
      return;
    }

    const first_name = addPlayerForm.first_name.trim();
    const last_name = addPlayerForm.last_name.trim();
    const jersey_number = addPlayerForm.jersey_number.trim();

    if (!last_name) {
      setMessage("Last name is required.");
      return;
    }

    const teamCode = selectedTeamId;
    const payload = {
      first_name: first_name || null,
      last_name,
      team_code: teamCode,
      jersey_number: jersey_number === "" ? null : Number(jersey_number),
      clear_existing_jersey: true,
    };

    const createPlayerRes = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const createPlayerJson = await createPlayerRes.json();

    if (!createPlayerRes.ok) {
      setMessage(`Error: ${createPlayerJson.error ?? "Unable to add player"}`);
      return;
    }

    const player_id = createPlayerJson.player_id;
    const seasonRowRes = await fetch("/api/admin/players/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_id,
        season: selectedSeason,
        team_id: selectedTeamId,
        jersey_number: jersey_number === "" ? null : Number(jersey_number),
        is_active: true,
      }),
    });

    const seasonRowJson = await seasonRowRes.json();

    if (!seasonRowRes.ok) {
      setMessage(`Error: ${seasonRowJson.error ?? "Unable to add player to roster"}`);
      return;
    }

    setAddPlayerForm({ first_name: "", last_name: "", jersey_number: "" });
    setMessage(`✓ Added ${first_name ? `${first_name} ` : ""}${last_name} to ${selectedTeamId}`);

    const refreshed = await fetch(`/api/admin/players/seasons?season=${encodeURIComponent(selectedSeason)}`);
    const refreshedJson = await refreshed.json();
    setRows(refreshedJson.player_seasons ?? []);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Edit Team Roster</h1>
        <a
          href="/admin/teams"
          className="text-sm px-3 py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-muted)]"
        >
          Manage teams
        </a>
      </div>

      {!isCurrentSeason && (
        <div className="mb-6 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Older seasons are read-only. Switch to the current season to edit team rosters.
        </div>
      )}

      <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--surface)]"
          >
            {seasons.map((season) => (
              <option key={season.season} value={season.season}>
                {season.season}{season.is_current ? " (current)" : ""}
              </option>
            ))}
          </select>

          {selectedSeason && !isCurrentSeason && (
            <button
              onClick={() => handleSetCurrent(selectedSeason)}
              className="text-sm px-4 py-2 rounded border border-orange-500 text-orange-600 hover:bg-orange-50"
            >
              Set as current season
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">
            Team
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="ml-2 border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--surface)]"
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.team_id} value={team.team_id}>
                  {team.team_name ?? team.team_id}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {message && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          {message}
        </p>
      )}

      {selectedTeamId && isCurrentSeason && (
        <form onSubmit={handleAddPlayer} className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <h2 className="text-lg font-semibold">Add player to {selectedTeamId}</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">
              First name
              <input
                value={addPlayerForm.first_name}
                onChange={(e) => setAddPlayerForm({ ...addPlayerForm, first_name: e.target.value })}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                placeholder="Ion"
              />
            </label>

            <label className="text-sm font-medium">
              Last name
              <input
                required
                value={addPlayerForm.last_name}
                onChange={(e) => setAddPlayerForm({ ...addPlayerForm, last_name: e.target.value })}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                placeholder="Popescu"
              />
            </label>

            <label className="text-sm font-medium">
              Jersey number
              <input
                type="number"
                value={addPlayerForm.jersey_number}
                onChange={(e) => setAddPlayerForm({ ...addPlayerForm, jersey_number: e.target.value })}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                placeholder="7"
              />
            </label>
          </div>

          <button type="submit" className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]">
            Add player to roster
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-gray-400 animate-pulse">Loading roster...</p>}

      {!selectedTeamId && !loading && (
        <p className="text-sm text-gray-400">Select a team to view its roster.</p>
      )}

      {selectedTeamId && !loading && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
            <h2 className="text-lg font-semibold">
              {teams.find((team) => team.team_id === selectedTeamId)?.team_name ?? selectedTeamId}
            </h2>
            <span className="text-xs text-[var(--text-muted)]">{teamRoster.length} players</span>
          </div>

          {teamRoster.length === 0 ? (
            <p className="text-sm text-gray-400">No players on this roster yet.</p>
          ) : (
            <div className="space-y-3">
              {teamRoster.map((player) => (
                <div
                  key={player.player_id}
                  className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${player.is_active ? "border-[var(--border)]" : "border-gray-300 bg-gray-100/40 opacity-60"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-gray-400 w-6 text-right shrink-0">
                      #{player.jersey_number ?? "—"}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {player.players?.first_name ?? ""} {player.players?.last_name ?? "Unknown player"}
                    </span>
                  </div>

                  {isCurrentSeason && (
                    <div className="flex items-center gap-2">
                      <select
                        value={player.team_id}
                        onChange={(e) => handleMovePlayer(player, e.target.value)}
                        className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
                      >
                        {teams.map((team) => (
                          <option key={team.team_id} value={team.team_id}>
                            {team.team_name ?? team.team_id}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(player)}
                        className={`text-xs px-2.5 py-1 rounded border ${
                          player.is_active
                            ? "border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500"
                            : "border-green-300 text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {player.is_active ? "Inactive" : "Active"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
