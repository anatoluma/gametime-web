"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import PlayerAvatar from "@/app/components/PlayerAvatar";

type Team = { team_id: string; team_name: string | null };

type PlayerSeasonRow = {
  player_id: string;
  season: string;
  team_id: string;
  jersey_number: number | null;
  is_active: boolean;
  players: { first_name: string | null; last_name: string | null; photo_url: string | null } | null;
};

export default function ManagerPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [rows, setRows] = useState<PlayerSeasonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingPlayerId, setUploadingPlayerId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, { first_name: string; last_name: string }>>({});
  const [addPlayerForm, setAddPlayerForm] = useState({
    first_name: "",
    last_name: "",
    jersey_number: "",
  });

  useEffect(() => {
    adminFetch("/api/manager/me")
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }: { ok: boolean; body: { teams?: Team[]; error?: string } }) => {
        if (!ok) {
          setMessage(`Error: ${body.error ?? "Manager access required"}`);
          return;
        }
        const t = body.teams;
        const list = t ?? [];
        setTeams(list);
        if (list.length > 0) setSelectedTeamId(list[0].team_id);
      });
  }, []);

  const loadRoster = async (teamId: string) => {
    if (!teamId) return;
    setLoading(true);
    try {
      const res = await adminFetch(`/api/manager/roster?team_id=${encodeURIComponent(teamId)}`);
      const json = await res.json();
      if (res.ok) {
        const nextRows = json.player_seasons ?? [];
        setRows(nextRows);
        setNameDrafts(Object.fromEntries(nextRows.map((row: PlayerSeasonRow) => [row.player_id, {
          first_name: row.players?.first_name ?? "",
          last_name: row.players?.last_name ?? "",
        }])));
      } else {
        setMessage(`Error: ${json.error ?? "Unable to load roster"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = async (row: PlayerSeasonRow) => {
    const draft = nameDrafts[row.player_id];
    if (!draft?.last_name.trim()) {
      setMessage("Last name is required.");
      return;
    }
    const res = await adminFetch("/api/manager/roster", {
      method: "PATCH",
      body: JSON.stringify({ player_id: row.player_id, season: row.season, ...draft }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(`Error: ${json.error ?? "Unable to update player name"}`);
      return;
    }
    setRows((prev) => prev.map((item) => item.player_id === row.player_id
      ? { ...item, players: { ...item.players, ...draft } as PlayerSeasonRow["players"] }
      : item));
    setMessage("✓ Player name updated");
  };

  useEffect(() => {
    void loadRoster(selectedTeamId);
  }, [selectedTeamId]);

  const selectedTeamName = useMemo(
    () => teams.find((t) => t.team_id === selectedTeamId)?.team_name ?? selectedTeamId,
    [teams, selectedTeamId]
  );

  const handleToggleActive = async (row: PlayerSeasonRow) => {
    const res = await adminFetch("/api/manager/roster", {
      method: "PATCH",
      body: JSON.stringify({ player_id: row.player_id, season: row.season, is_active: !row.is_active }),
    });

    if (res.ok) {
      setRows((prev) =>
        prev.map((r) => (r.player_id === row.player_id ? { ...r, is_active: !r.is_active } : r))
      );
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error ?? "Unable to update player status"}`);
    }
  };

  const handleJerseyChange = async (row: PlayerSeasonRow, value: string) => {
    const jersey_number = value === "" ? null : Number(value);
    if (jersey_number !== null && !Number.isFinite(jersey_number)) return;

    const res = await adminFetch("/api/manager/roster", {
      method: "PATCH",
      body: JSON.stringify({ player_id: row.player_id, season: row.season, jersey_number }),
    });

    if (res.ok) {
      setRows((prev) =>
        prev.map((r) => (r.player_id === row.player_id ? { ...r, jersey_number } : r))
      );
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error ?? "Unable to update jersey number"}`);
    }
  };

  const handlePhotoChange = async (row: PlayerSeasonRow, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingPlayerId(row.player_id);
    try {
      const formData = new FormData();
      formData.append("player_id", row.player_id);
      formData.append("file", file);

      const res = await adminFetch("/api/manager/photo", { method: "POST", body: formData });
      const json = await res.json();

      if (res.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.player_id === row.player_id
              ? { ...r, players: { ...r.players, photo_url: json.photo_url } as PlayerSeasonRow["players"] }
              : r
          )
        );
        setMessage("✓ Photo updated");
      } else {
        setMessage(`Error: ${json.error ?? "Unable to upload photo"}`);
      }
    } finally {
      setUploadingPlayerId(null);
    }
  };

  const handleAddPlayer = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedTeamId) return;

    const first_name = addPlayerForm.first_name.trim();
    const last_name = addPlayerForm.last_name.trim();
    const jersey_number = addPlayerForm.jersey_number.trim();

    if (!last_name) {
      setMessage("Last name is required.");
      return;
    }

    const res = await adminFetch("/api/manager/roster", {
      method: "POST",
      body: JSON.stringify({
        first_name: first_name || null,
        last_name,
        team_id: selectedTeamId,
        jersey_number: jersey_number === "" ? null : Number(jersey_number),
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setMessage(`Error: ${json.error ?? "Unable to add player"}`);
      return;
    }

    setAddPlayerForm({ first_name: "", last_name: "", jersey_number: "" });
    setMessage(`✓ Added ${first_name ? `${first_name} ` : ""}${last_name}`);
    void loadRoster(selectedTeamId);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Team Roster</h1>

      {teams.length > 1 && (
        <div className="mb-6">
          <label className="text-sm font-medium">
            Team
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="ml-2 border border-[var(--border)] rounded px-3 py-2 text-sm bg-[var(--surface)]"
            >
              {teams.map((team) => (
                <option key={team.team_id} value={team.team_id}>
                  {team.team_name ?? team.team_id}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {message && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          {message}
        </p>
      )}

      {selectedTeamId && (
        <form onSubmit={handleAddPlayer} className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <h2 className="text-lg font-semibold">Add player to {selectedTeamName}</h2>

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

      {selectedTeamId && !loading && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
            <h2 className="text-lg font-semibold">{selectedTeamName}</h2>
            <span className="text-xs text-[var(--text-muted)]">{rows.length} players</span>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-gray-400">No players on this roster yet.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const name = `${row.players?.first_name ?? ""} ${row.players?.last_name ?? "Unknown player"}`.trim();
                return (
                  <div
                    key={row.player_id}
                    className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${row.is_active ? "border-[var(--border)]" : "border-gray-300 bg-gray-100/40 opacity-60"}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar
                        playerId={row.player_id}
                        playerName={name}
                        photoUrl={row.players?.photo_url}
                        width={40}
                        height={50}
                        className="h-10 w-8 shrink-0 rounded object-cover"
                      />
                      <input
                        type="number"
                        defaultValue={row.jersey_number ?? ""}
                        onBlur={(e) => handleJerseyChange(row, e.target.value)}
                        className="w-14 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-right"
                      />
                      <div className="grid min-w-0 grid-cols-2 gap-2">
                        <input
                          value={nameDrafts[row.player_id]?.first_name ?? ""}
                          onChange={(e) => setNameDrafts((prev) => ({ ...prev, [row.player_id]: { ...prev[row.player_id], first_name: e.target.value } }))}
                          className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
                          aria-label={`First name for ${name}`}
                        />
                        <input
                          value={nameDrafts[row.player_id]?.last_name ?? ""}
                          onChange={(e) => setNameDrafts((prev) => ({ ...prev, [row.player_id]: { ...prev[row.player_id], last_name: e.target.value } }))}
                          className="w-full min-w-0 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
                          aria-label={`Last name for ${name}`}
                        />
                        <button type="button" onClick={() => handleNameChange(row)} className="col-span-2 justify-self-start text-xs text-[var(--accent)] underline">
                          Save name
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="text-xs px-2.5 py-1 rounded border border-[var(--border)] hover:bg-[var(--surface-muted)] cursor-pointer">
                        {uploadingPlayerId === row.player_id ? "Uploading..." : "Photo"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingPlayerId === row.player_id}
                          onChange={(e) => handlePhotoChange(row, e)}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(row)}
                        className={`text-xs px-2.5 py-1 rounded border ${
                          row.is_active
                            ? "border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500"
                            : "border-green-300 text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {row.is_active ? "Inactive" : "Active"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
