"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/admin-fetch";

type Team = {
  team_id: string;
  team_name: string | null;
  city: string | null;
  coach: string | null;
  /** Season-scoped: plays the selected season. */
  is_active: boolean | null;
  /** Global: the franchise exists in the league. */
  league_active?: boolean | null;
};

type Season = { season: string; is_current: boolean };

type Banner = { text: string; kind: "success" | "error" } | null;

type EditDraft = { team_name: string; city: string; coach: string };

const TEAM_ID_RE = /^[A-Z0-9]{2,4}$/;

export default function AdminTeamsPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagueTeams, setLeagueTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [addMode, setAddMode] = useState<"new" | "existing">("new");
  const [selectedExistingTeamId, setSelectedExistingTeamId] = useState("");
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ team_name: "", city: "", coach: "" });
  const [form, setForm] = useState({ team_id: "", team_name: "", city: "", coach: "" });

  /** Shared response handling: bounces to /login on 401, otherwise surfaces the API's own message. */
  const readResponse = useCallback(
    async (res: Response) => {
      if (res.status === 401) {
        router.replace("/login");
        return { ok: false as const, json: null };
      }
      const json = await res.json().catch(() => null);
      return { ok: res.ok, json };
    },
    [router]
  );

  const fail = useCallback((json: { error?: string } | null, fallback: string) => {
    setBanner({ text: json?.error ?? fallback, kind: "error" });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSeasons = async () => {
      const res = await adminFetch("/api/admin/seasons");
      const { ok, json } = await readResponse(res);
      if (!isMounted) return;

      if (!ok) {
        fail(json, "Failed to load seasons");
        setLoading(false);
        return;
      }

      const list: Season[] = json?.seasons ?? [];
      setSeasons(list);
      setSelectedSeason(list.find((season) => season.is_current)?.season ?? list[0]?.season ?? "");
    };

    void loadSeasons();

    return () => {
      isMounted = false;
    };
  }, [readResponse, fail]);

  const loadTeams = useCallback(async () => {
    if (!selectedSeason) return;
    const res = await adminFetch(`/api/admin/teams?season=${encodeURIComponent(selectedSeason)}`);
    const { ok, json } = await readResponse(res);
    if (!ok) {
      fail(json, "Failed to load teams");
      return;
    }
    setTeams(json?.teams ?? []);
  }, [selectedSeason, readResponse, fail]);

  useEffect(() => {
    if (!selectedSeason) return;

    let isMounted = true;

    void (async () => {
      setLoading(true);
      // Re-lock and drop any open editor whenever the season changes.
      setUnlocked(false);
      setEditingTeamId(null);
      const res = await adminFetch(`/api/admin/teams?season=${encodeURIComponent(selectedSeason)}`);
      const { ok, json } = await readResponse(res);
      if (!isMounted) return;
      if (ok) setTeams(json?.teams ?? []);
      else fail(json, "Failed to load teams");
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedSeason, readResponse, fail]);

  // The full franchise list, used to offer any team not yet enrolled.
  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const res = await adminFetch("/api/admin/teams");
      const { ok, json } = await readResponse(res);
      if (!isMounted) return;
      if (ok) setLeagueTeams(json?.teams ?? []);
    })();

    return () => {
      isMounted = false;
    };
  }, [readResponse]);

  /** Newest season strictly older than the selected one. */
  const previousSeason = useMemo(
    () =>
      [...seasons]
        .map((season) => season.season)
        .sort((a, b) => b.localeCompare(a))
        .find((season) => season < selectedSeason) ?? "",
    [seasons, selectedSeason]
  );

  const isCurrentSeason = useMemo(
    () => !!seasons.find((season) => season.season === selectedSeason)?.is_current,
    [selectedSeason, seasons]
  );

  const canEdit = isCurrentSeason || unlocked;

  const activeCount = useMemo(() => teams.filter((team) => team.is_active ?? false).length, [teams]);
  const inactiveCount = teams.length - activeCount;

  const orderedTeams = useMemo(
    () =>
      [...teams].sort((a, b) => {
        const activeDiff = Number(Boolean(b.is_active)) - Number(Boolean(a.is_active));
        if (activeDiff !== 0) return activeDiff;
        return (a.team_name ?? a.team_id).localeCompare(b.team_name ?? b.team_id);
      }),
    [teams]
  );

  const enrollableTeams = useMemo(() => {
    const enrolled = new Set(teams.map((team) => team.team_id));
    return leagueTeams
      .filter((team) => !enrolled.has(team.team_id))
      .sort((a, b) => (a.team_name ?? a.team_id).localeCompare(b.team_name ?? b.team_id));
  }, [leagueTeams, teams]);

  /**
   * Every mutation funnels through here so the edit guardrail can't be bypassed.
   * Routine edits on the current season go through without a prompt; anything
   * destructive (`always`) or aimed at a published season always confirms.
   */
  const guard = (confirmMessage: string, always = false) => {
    if (!canEdit) {
      setBanner({ text: `${selectedSeason} is locked. Tick the edit checkbox to make changes.`, kind: "error" });
      return false;
    }
    if ((always || !isCurrentSeason) && !confirm(confirmMessage)) return false;
    return true;
  };

  const runSeeding = async (
    body: Record<string, unknown>,
    confirmMessage: string,
    describe: (json: Record<string, number>) => string
  ) => {
    if (!guard(confirmMessage, true)) return;

    setBusy(true);
    const res = await adminFetch("/api/admin/teams", { method: "POST", body: JSON.stringify(body) });
    const { ok, json } = await readResponse(res);
    setBusy(false);

    if (!ok) {
      fail(json, "Seeding failed");
      return;
    }

    setBanner({ text: `✓ ${describe(json)}`, kind: "success" });
    await loadTeams();
  };

  const handleImportAll = () =>
    runSeeding(
      { action: "import_all_league_teams", season: selectedSeason },
      `Enroll every active league team into ${selectedSeason}?`,
      (json) => `Imported ${json.imported} team(s) into ${selectedSeason}`
    );

  const handleCopyFromPrevious = () =>
    runSeeding(
      { action: "copy_from_season", source_season: previousSeason, target_season: selectedSeason },
      `Copy the ${previousSeason} team list into ${selectedSeason}?`,
      (json) => `Copied ${json.copied} team(s) from ${previousSeason}`
    );

  const handleDeriveFromGames = () =>
    runSeeding(
      { action: "derive_from_games", season: selectedSeason },
      `Enroll every team that appears in a ${selectedSeason} game?`,
      (json) => `Enrolled ${json.derived} team(s) from ${selectedSeason} games`
    );

  const handleSetCurrentSeason = async (season: string) => {
    const res = await adminFetch(`/api/admin/seasons/${encodeURIComponent(season)}`, {
      method: "PATCH",
      body: JSON.stringify({ is_current: true }),
    });
    const { ok, json } = await readResponse(res);

    if (!ok) {
      fail(json, "Unable to change current season");
      return;
    }

    setSeasons((prev) => prev.map((item) => ({ ...item, is_current: item.season === season })));
    setSelectedSeason(season);
    setBanner({ text: `✓ ${season} is now the current season`, kind: "success" });
  };

  const handleCreateTeam = async (event: React.FormEvent) => {
    event.preventDefault();

    const team_id = form.team_id.trim().toUpperCase();
    if (!TEAM_ID_RE.test(team_id)) {
      setBanner({ text: "Team code must be 2-4 letters or digits, e.g. EDI or CN2", kind: "error" });
      return;
    }
    if (!form.team_name.trim()) {
      setBanner({ text: "Team name is required", kind: "error" });
      return;
    }
    if (!guard(`Create ${form.team_name.trim()} and enroll it in ${selectedSeason}?`)) return;

    const res = await adminFetch("/api/admin/teams", {
      method: "POST",
      body: JSON.stringify({
        action: "create_team",
        season: selectedSeason,
        team_id,
        team_name: form.team_name,
        city: form.city,
        coach: form.coach,
      }),
    });
    const { ok, json } = await readResponse(res);

    if (!ok) {
      fail(json, "Unable to create team");
      return;
    }

    setBanner({ text: `✓ Created ${json.team?.team_name ?? team_id}`, kind: "success" });
    setForm({ team_id: "", team_name: "", city: "", coach: "" });
    setShowAddTeam(false);
    setLeagueTeams((prev) => [...prev, json.team]);
    await loadTeams();
  };

  const handleEnrollExisting = async () => {
    const team = enrollableTeams.find((item) => item.team_id === selectedExistingTeamId);
    if (!team) {
      setBanner({ text: "Select a team to add.", kind: "error" });
      return;
    }
    if (!guard(`Add ${team.team_name ?? team.team_id} to ${selectedSeason}?`)) return;

    const res = await adminFetch("/api/admin/teams", {
      method: "POST",
      body: JSON.stringify({ action: "enroll_team", season: selectedSeason, team_id: team.team_id }),
    });
    const { ok, json } = await readResponse(res);

    if (!ok) {
      fail(json, "Unable to add team");
      return;
    }

    setBanner({ text: `✓ Added ${json.team?.team_name ?? team.team_id} to ${selectedSeason}`, kind: "success" });
    setSelectedExistingTeamId("");
    setShowAddTeam(false);
    await loadTeams();
  };

  const startEditing = (team: Team) => {
    setEditingTeamId(team.team_id);
    setEditDraft({
      team_name: team.team_name ?? "",
      city: team.city ?? "",
      coach: team.coach ?? "",
    });
  };

  const handleSaveDetails = async (team: Team) => {
    if (!editDraft.team_name.trim()) {
      setBanner({ text: "Team name cannot be empty", kind: "error" });
      return;
    }
    if (!guard(`Save league-wide details for ${editDraft.team_name.trim()}?`)) return;

    // No `season` and no `is_active`: this is a league-wide detail edit.
    const res = await adminFetch("/api/admin/teams", {
      method: "PATCH",
      body: JSON.stringify({
        team_id: team.team_id,
        team_name: editDraft.team_name,
        city: editDraft.city,
        coach: editDraft.coach,
      }),
    });
    const { ok, json } = await readResponse(res);

    if (!ok) {
      fail(json, "Unable to save team details");
      return;
    }

    setEditingTeamId(null);
    setBanner({ text: `✓ Saved ${json.team?.team_name ?? team.team_id}`, kind: "success" });
    await loadTeams();
  };

  const handleToggleActive = async (team: Team) => {
    const next = !(team.is_active ?? false);
    if (!guard(`${next ? "Activate" : "Deactivate"} ${team.team_name ?? team.team_id} for ${selectedSeason}?`)) return;

    const res = await adminFetch("/api/admin/teams", {
      method: "PATCH",
      body: JSON.stringify({ team_id: team.team_id, season: selectedSeason, is_active: next }),
    });
    const { ok, json } = await readResponse(res);

    if (!ok) {
      fail(json, "Unable to update season participation");
      return;
    }

    setTeams((prev) =>
      prev.map((item) => (item.team_id === team.team_id ? { ...item, is_active: next } : item))
    );
    setBanner({
      text: `✓ ${team.team_name ?? team.team_id} ${next ? "plays" : "does not play"} ${selectedSeason}`,
      kind: "success",
    });
  };

  const handleRemove = async (team: Team) => {
    const label = team.team_name ?? team.team_id;
    if (!guard(`Remove ${label} from ${selectedSeason}? The team itself is not deleted.`, true)) return;

    const res = await adminFetch(
      `/api/admin/teams?team_id=${encodeURIComponent(team.team_id)}&season=${encodeURIComponent(selectedSeason)}`,
      { method: "DELETE" }
    );
    const { ok, json } = await readResponse(res);

    if (!ok) {
      // A 409 here carries the game/roster counts — show it verbatim.
      fail(json, "Unable to remove team");
      return;
    }

    setTeams((prev) => prev.filter((item) => item.team_id !== team.team_id));
    setBanner({ text: `✓ Removed ${label} from ${selectedSeason}`, kind: "success" });
  };

  const seedingButtonClass =
    "rounded border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50";

  const seedingActions = (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={handleImportAll} disabled={busy || !canEdit} className={seedingButtonClass}>
        Import all league teams
      </button>
      {previousSeason && (
        <button
          type="button"
          onClick={handleCopyFromPrevious}
          disabled={busy || !canEdit}
          className={seedingButtonClass}
        >
          Copy from {previousSeason}
        </button>
      )}
      <button type="button" onClick={handleDeriveFromGames} disabled={busy || !canEdit} className={seedingButtonClass}>
        Rebuild from played games
      </button>
    </div>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 text-[var(--foreground)] bg-[var(--surface)] min-h-screen">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Season Teams</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {selectedSeason || "—"} • {activeCount} playing • {inactiveCount} inactive
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
              {season.season}
              {season.is_current ? " (current)" : ""}
            </option>
          ))}
        </select>

        {selectedSeason && !isCurrentSeason && (
          <button
            type="button"
            onClick={() => handleSetCurrentSeason(selectedSeason)}
            className="text-sm px-4 py-2 rounded border border-orange-500 text-orange-600 hover:bg-orange-50"
          >
            Set as current season
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowAddTeam((prev) => !prev)}
          disabled={!canEdit}
          className="text-sm px-4 py-2 rounded border border-[var(--border)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add team
        </button>
      </div>

      {banner && (
        <p
          className={`mb-4 rounded border px-3 py-2 text-sm ${
            banner.kind === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {banner.text}
        </p>
      )}

      {!isCurrentSeason && selectedSeason && (
        <div className="mb-6 rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
          <p>
            {selectedSeason} is not the current season. Changes here affect published standings and team pages.
          </p>
          <label className="mt-2 flex items-center gap-2 font-medium">
            <input type="checkbox" checked={unlocked} onChange={(e) => setUnlocked(e.target.checked)} />
            Let me edit {selectedSeason}
          </label>
        </div>
      )}

      {showAddTeam && canEdit && (
        <div className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Add team to {selectedSeason}</h2>
            <button
              type="button"
              onClick={() => setShowAddTeam(false)}
              className="text-sm hover:text-[var(--text-muted)]"
            >
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
              Existing league team
            </label>
          </div>

          {addMode === "new" ? (
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  Team code
                  <input
                    value={form.team_id}
                    onChange={(e) => setForm({ ...form, team_id: e.target.value.toUpperCase() })}
                    placeholder="EDI"
                    maxLength={4}
                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                  <span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">
                    2-4 letters or digits. Cannot be changed later.
                  </span>
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

              <button
                type="submit"
                className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface)]"
              >
                Create and enroll
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Teams not yet in {selectedSeason}
                <select
                  value={selectedExistingTeamId}
                  onChange={(e) => setSelectedExistingTeamId(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                >
                  <option value="">Select a team</option>
                  {enrollableTeams.map((team) => (
                    <option key={team.team_id} value={team.team_id}>
                      {team.team_name ?? team.team_id} ({team.team_id})
                    </option>
                  ))}
                </select>
              </label>

              {enrollableTeams.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">
                  Every league team is already enrolled in {selectedSeason}.
                </p>
              )}

              <button
                type="button"
                onClick={handleEnrollExisting}
                disabled={!selectedExistingTeamId}
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
      ) : teams.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">No teams enrolled in {selectedSeason}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Seed the list, then add or remove individual teams.</p>
          </div>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            <li>
              <strong>Import all league teams</strong> — every active team from the league roster. Best for a fresh
              season.
            </li>
            {previousSeason && (
              <li>
                <strong>Copy from {previousSeason}</strong> — last season&apos;s line-up, for a normal rollover.
              </li>
            )}
            <li>
              <strong>Rebuild from played games</strong> — exactly the teams that appear in this season&apos;s results.
              For backfilling history.
            </li>
          </ul>
          {seedingActions}
          {!canEdit && (
            <p className="text-xs text-amber-700">Unlock {selectedSeason} above to use these actions.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <details className="rounded border border-[var(--border)] px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">Bulk actions</summary>
            <div className="mt-3">{seedingActions}</div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              These only add missing teams. They never re-activate a team you deactivated.
            </p>
          </details>

          <div className="space-y-3">
            {orderedTeams.map((team, index) => (
              <div
                key={team.team_id}
                className={`rounded border px-4 py-3 ${
                  team.is_active ? "border-green-300 bg-green-50/40" : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                {editingTeamId === team.team_id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className="rounded bg-[var(--surface-muted)] px-2 py-1 font-semibold uppercase tracking-wide"
                        title="Team code cannot be changed — games, players and rosters reference it"
                      >
                        {team.team_id}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">code is fixed</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <label className="text-xs font-medium">
                        Team name
                        <input
                          value={editDraft.team_name}
                          onChange={(e) => setEditDraft({ ...editDraft, team_name: e.target.value })}
                          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs font-medium">
                        City
                        <input
                          value={editDraft.city}
                          onChange={(e) => setEditDraft({ ...editDraft, city: e.target.value })}
                          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs font-medium">
                        Coach
                        <input
                          value={editDraft.coach}
                          onChange={(e) => setEditDraft({ ...editDraft, coach: e.target.value })}
                          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>

                    <p className="text-xs text-[var(--text-muted)]">
                      These details are league-wide — they apply to every season.
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveDetails(team)}
                        className="rounded border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTeamId(null)}
                        className="rounded border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="w-8 text-sm font-semibold text-[var(--text-muted)]">#{index + 1}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold uppercase tracking-wide">{team.team_id}</span>
                          <span className="text-base font-medium">{team.team_name ?? "Unnamed team"}</span>
                          {team.league_active === false && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                              retired
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          {team.city ?? "City not set"} {team.coach ? `• Coach: ${team.coach}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(team)}
                        disabled={!canEdit}
                        className="rounded border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(team)}
                        disabled={!canEdit}
                        title="Whether this team plays the selected season"
                        className={`rounded border px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                          team.is_active
                            ? "border-red-300 text-red-600 hover:bg-red-50"
                            : "border-green-300 text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {team.is_active ? "Not playing" : "Plays this season"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(team)}
                        disabled={!canEdit}
                        className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            Teams with games or rostered players in this season can&apos;t be removed — deactivate them instead.
          </p>
        </div>
      )}
    </main>
  );
}
