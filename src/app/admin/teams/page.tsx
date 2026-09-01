"use client";

import { useEffect, useMemo, useState } from "react";

type Team = {
  team_id: string;
  team_name: string | null;
  city: string | null;
  coach: string | null;
  is_active: boolean | null;
};

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    team_id: "",
    team_name: "",
    city: "",
    coach: "",
    is_active: true,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchTeams = async () => {
      setLoading(true);
      const res = await fetch("/api/admin/teams");
      const json = await res.json();

      if (!isMounted) return;

      if (res.ok) {
        setTeams(json.teams ?? []);
      } else {
        setMessage(`Error: ${json.error ?? "Failed to load teams"}`);
      }
      setLoading(false);
    };

    void fetchTeams();

    return () => {
      isMounted = false;
    };
  }, []);

  const teamCount = useMemo(() => teams.filter((team) => team.is_active ?? false).length, [teams]);
  const inactiveTeamCount = useMemo(() => teams.filter((team) => !(team.is_active ?? false)).length, [teams]);

  const handleCreateOrUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
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
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (res.ok) {
      setMessage(`✓ Saved ${json.team?.team_name ?? form.team_name}`);
      setForm({ team_id: "", team_name: "", city: "", coach: "", is_active: true });
      const next = async () => {
        const res2 = await fetch("/api/admin/teams");
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
    const res = await fetch("/api/admin/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: team.team_id, is_active: !(team.is_active ?? false) }),
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

      {message && (
        <p className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </p>
      )}

      <form onSubmit={handleCreateOrUpdate} className="mb-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Add or update team</h2>
          <a
            href="/admin/players"
            className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--surface-muted)]"
          >
            Roster editor
          </a>
        </div>

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

          {teams.length === 0 && <p className="text-sm text-gray-400">No teams registered yet.</p>}
        </div>
      )}
    </main>
  );
}
