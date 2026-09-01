"use client";

import { useEffect, useMemo, useState } from "react";

type Team = {
  team_id: string;
  team_name: string | null;
  city: string | null;
  coach: string | null;
  is_active: boolean | null;
};

type Season = { season: string; is_current: boolean };

export default function AdminTeamsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [previousSeasonTeams, setPreviousSeasonTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [addMode, setAddMode] = useState<"new" | "existing">("new");
  const [selectedPreviousTeamId, setSelectedPreviousTeamId] = useState("");
  const [form, setForm] = useState({
    team_id: "",
    team_name: "",
    city: "",
    coach: "",
    is_active: true,
  });

  useEffect(() => {
    fetch("/api/admin/seasons")
      .then((r) => r.json())
      .then(({ seasons: seasonList }: { seasons: Season[] }) => {
        const list = seasonList ?? [];
        setSeasons(list);
        const current = list.find((season) => season.is_current)?.season ?? list[0]?.season ?? "";
        setSelectedSeason(current);
      });
  }, []);

  useEffect(() => {
    if (!selectedSeason) return;

    let isMounted = true;

    const fetchTeams = async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/teams?season=${encodeURIComponent(selectedSeason)}`);
      const json = await res.json();

      if (!isMounted) return;

      if (res.ok) {
        const seasonTeams = json.teams ?? [];

        if (seasonTeams.length === 0 && !seasons.find((season) => season.season === selectedSeason)?.is_current) {
          const legacyRes = await fetch("/api/admin/teams");
          const legacyJson = await legacyRes.json();
          setTeams(legacyRes.ok ? (legacyJson.teams ?? []) : []);
        } else {
          setTeams(seasonTeams);
        }
      } else {
        setMessage(`Error: ${json.error ?? "Failed to load teams"}`);
      }
      setLoading(false);
    };

    void fetchTeams();

    return () => {
      isMounted = false;
    };
  }, [selectedSeason]);

  const previousSeason = useMemo(() => {
    const sorted = [...seasons].sort((a, b) => b.season.localeCompare(a.season));
    return sorted.find((season) => season.season !== selectedSeason && !season.is_current)?.season ?? "";
  }, [seasons, selectedSeason]);

  useEffect(() => {
    if (!previousSeason) {
      setPreviousSeasonTeams([]);
      return;
    }

    const fetchPreviousSeasonTeams = async () => {
      const res = await fetch(`/api/admin/teams?season=${encodeURIComponent(previousSeason)}`);
      const json = await res.json();
      setPreviousSeasonTeams(res.ok ? (json.teams ?? []) : []);
    };

    void fetchPreviousSeasonTeams();
  }, [previousSeason]);

  const currentSeasonOnly = useMemo(
    () => !!seasons.find((season) => season.season === selectedSeason)?.is_current,
    [selectedSeason, seasons]
  );

  const teamCount = useMemo(() => teams.filter((team) => team.is_active ?? false).length, [teams]);
  const inactiveTeamCount = useMemo(() => teams.filter((team) => !(team.is_active ?? false)).length, [teams]);

  const handleSetCurrentSeason = async (season: string) => {
    const res = await fetch(`/api/admin/seasons/${encodeURIComponent(season)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_current: true }),
    });

    if (res.ok) {
      setSeasons((prev) => prev.map((item) => ({ ...item, is_current: item.season === season })));
      setSelectedSeason(season);
      setMessage(`✓ ${season} is now the current season`);
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error ?? "Unable to change current season"}`);
    }
  };

  const handleAddExistingTeam = async () => {
    if (!currentSeasonOnly) {
      setMessage("Only the current season can be edited.");
      return;
    }

    const selectedTeam = previousSeasonTeams.find((team) => team.team_id === selectedPreviousTeamId);
    if (!selectedTeam) {
      setMessage("Select a team from the previous season to add.");
      return;
    }

    const response = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        season: selectedSeason,
        team_id: selectedTeam.team_id,
        team_name: selectedTeam.team_name,
        city: selectedTeam.city,
        coach: selectedTeam.coach,
        is_active: true,
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      setMessage(`Error: ${json.error ?? "Unable to add team"}`);
      return;
    }

    setTeams((prev) => [{ ...selectedTeam, is_active: true }, ...prev.filter((team) => team.team_id !== selectedTeam.team_id)]);
    setSelectedPreviousTeamId("");
    setAddMode("new");
    setShowAddTeam(false);
    setMessage(`✓ Added ${selectedTeam.team_name ?? selectedTeam.team_id} to ${selectedSeason}`);
  };

  const handleCreateOrUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentSeasonOnly) {
      setMessage("Only the current season can be edited.");
      return;
    }

    const payload = {
      team_id: form.team_id,
      team_name: form.team_name,
      city: form.city,
      coach: form.coach,
      is_active: form.is_active,
    };

    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, season: selectedSeason }),
    });
    const json = await res.json();

    if (res.ok) {
      setMessage(`✓ Saved ${json.team?.team_name ?? form.team_name}`);
      setForm({ team_id: "", team_name: "", city: "", coach: "", is_active: true });
      const next = async () => {
        const res2 = await fetch(`/api/admin/teams?season=${encodeURIComponent(selectedSeason)}`);
        const json2 = await res2.json();
        if (res2.ok) {
          setTeams(json2.teams ?? []);
        }
      };
      void next();
    } else {
      setMessage(`Error: ${json.error ?? "Unable to save team"}`);
    }
  };

  const handleToggleActive = async (team: Team) => {
    if (!currentSeasonOnly) {
      setMessage("Only the current season can be edited.");
      return;
    }
    const res = await fetch("/api/admin/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season: selectedSeason, team_id: team.team_id, is_active: !(team.is_active ?? false) }),
    });
    const json = await res.json();

    if (res.ok) {
      setTeams((prev) =>
        prev.map((item) =>
          item.team_id === team.team_id ? { ...item, is_active: !(team.is_active ?? false) } : item
        )
      );
      setMessage(`✓ ${team.team_name ?? team.team_id} is now ${!(team.is_active ?? false) ? "active" : "inactive"}`);
    } else {
      setMessage(`Error: ${json.error ?? "Unable to update team status"}`);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Current Season Teams</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {teamCount} active • {inactiveTeamCount} inactive
          </p>
        </div>
        <a
          href="/admin"
          className="text-sm px-3 py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-muted)]"
        >
          Back to admin
        </a>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
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

        {selectedSeason && !currentSeasonOnly && (
          <button
            type="button"
            onClick={() => handleSetCurrentSeason(selectedSeason)}
            className="text-sm px-4 py-2 rounded border border-orange-500 text-orange-600 hover:bg-orange-50"
          >
            Set as current season
          </button>
        )}

        {currentSeasonOnly && (
          <button
            type="button"
            onClick={() => setShowAddTeam((prev) => !prev)}
            className="text-sm px-4 py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-muted)]"
          >
            + Add team
          </button>
        )}
      </div>

      {message && (
        <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </p>
      )}

      {!currentSeasonOnly && (
        <div className="mb-6 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This season is read-only. Switch to the current season to manage the teams list.
        </div>
      )}

      {showAddTeam && currentSeasonOnly && (
        <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Add team to {selectedSeason}</h2>
            <button type="button" onClick={() => setShowAddTeam(false)} className="text-sm hover:text-[var(--text-muted)]">
              Close
            </button>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="add-team-mode"
                checked={addMode === "new"}
                onChange={() => setAddMode("new")}
              />
              New team
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="add-team-mode"
                checked={addMode === "existing"}
                onChange={() => setAddMode("existing")}
              />
              Add from {previousSeason || "previous season"}
            </label>
          </div>

          {addMode === "new" ? (
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  Team code
                  <input
                    value={form.team_id}
                    onChange={(e) => setForm({ ...form, team_id: e.target.value.toUpperCase() })}
                    placeholder="EDI"
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="text-sm font-medium">
                  Team name
                  <input
                    value={form.team_name}
                    onChange={(e) => setForm({ ...form, team_name: e.target.value })}
                    placeholder="Editura Dacia"
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="text-sm font-medium">
                  City
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Chisinau"
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>

                <label className="text-sm font-medium">
                  Coach
                  <input
                    value={form.coach}
                    onChange={(e) => setForm({ ...form, coach: e.target.value })}
                    placeholder="John Smith"
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active in current season
              </label>

              <button
                type="submit"
                className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
              >
                Save team
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Choose from previous season
                <select
                  value={selectedPreviousTeamId}
                  onChange={(e) => setSelectedPreviousTeamId(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                >
                  <option value="">Select a team</option>
                  {previousSeasonTeams.map((team) => (
                    <option key={team.team_id} value={team.team_id}>
                      {team.team_name ?? team.team_id}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={handleAddExistingTeam}
                disabled={!selectedPreviousTeamId}
                className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add selected team
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading teams...</p>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <div
              key={team.team_id}
              className={`flex items-center justify-between gap-4 rounded border px-4 py-3 ${team.is_active ? "border-green-300 bg-green-50/40" : "border-[var(--border)] bg-[var(--surface)]"}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold uppercase tracking-wide">{team.team_id}</span>
                  <span className="text-base font-medium">{team.team_name ?? "Unnamed team"}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  {team.city ?? "City not set"} {team.coach ? `• Coach: ${team.coach}` : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggleActive(team)}
                className={`rounded border px-3 py-1.5 text-xs font-medium ${
                  team.is_active
                    ? "border-red-300 text-red-600 hover:bg-red-50"
                    : "border-green-300 text-green-700 hover:bg-green-50"
                }`}
              >
                {team.is_active ? "Set inactive" : "Set active"}
              </button>
            </div>
          ))}

          {teams.length === 0 && (
            <p className="text-sm text-gray-400">
              {currentSeasonOnly ? "This season is empty. Use + Add team to start your list." : "No teams registered yet."}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
