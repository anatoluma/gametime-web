"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

type Team = { team_id: string; team_name: string | null };
type LinkRow = { id: string; team_id: string; expires_at: string; revoked_at: string | null; teams?: { team_name: string | null } | null };

export default function ManagerLinksPanel() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [teamId, setTeamId] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 16));
  const [newLink, setNewLink] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [teamsResponse, linksResponse] = await Promise.all([
      adminFetch("/api/admin/teams"),
      adminFetch("/api/admin/manager-links"),
    ]);
    const teamsJson = await teamsResponse.json();
    const linksJson = await linksResponse.json();
    const nextTeams = teamsJson.teams ?? [];
    setTeams(nextTeams);
    setLinks(linksJson.links ?? []);
    if (!teamId && nextTeams.length > 0) setTeamId(nextTeams[0].team_id);
  };

  useEffect(() => {
    let active = true;
    Promise.all([adminFetch("/api/admin/teams"), adminFetch("/api/admin/manager-links")])
      .then(async ([teamsResponse, linksResponse]) => {
        const teamsJson = await teamsResponse.json();
        const linksJson = await linksResponse.json();
        if (!active) return;
        const nextTeams = teamsJson.teams ?? [];
        setTeams(nextTeams);
        setLinks(linksJson.links ?? []);
        if (nextTeams.length > 0) setTeamId((current) => current || nextTeams[0].team_id);
      });
    return () => { active = false; };
  }, []);

  const createLink = async () => {
    setNewLink("");
    const response = await adminFetch("/api/admin/manager-links", {
      method: "POST",
      body: JSON.stringify({ team_id: teamId, expires_at: new Date(expiresAt).toISOString() }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(`Error: ${body.error ?? "Unable to create link"}`);
      return;
    }
    setNewLink(body.link.url);
    setMessage("Link created. Copy it now; it will not be shown again.");
    void load();
  };

  const revokeLink = async (id: string) => {
    const response = await adminFetch("/api/admin/manager-links", { method: "DELETE", body: JSON.stringify({ id }) });
    if (response.ok) {
      setLinks((current) => current.map((link) => link.id === id ? { ...link, revoked_at: new Date().toISOString() } : link));
      setMessage("Link revoked.");
    }
  };

  return (
    <section className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-2 text-xl font-semibold">Temporary team links</h2>
      <p className="mb-4 text-sm text-[var(--text-muted)]">Anyone with a link can edit that team&apos;s current roster and player photos until it expires.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Team<select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="mt-1 block rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          {teams.map((team) => <option key={team.team_id} value={team.team_id}>{team.team_name ?? team.team_id}</option>)}
        </select></label>
        <label className="text-sm font-medium">Expires<input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 block rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2" /></label>
        <button type="button" onClick={createLink} disabled={!teamId} className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium disabled:opacity-50">Create link</button>
      </div>
      {newLink && <div className="mt-4 break-all rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800"><a href={newLink} className="underline">{newLink}</a></div>}
      {message && <p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p>}
      <div className="mt-5 space-y-2">
        {links.map((link) => <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-2 text-sm">
          <span>{link.teams?.team_name ?? link.team_id} · expires {new Date(link.expires_at).toLocaleString()} {link.revoked_at ? "· revoked" : ""}</span>
          {!link.revoked_at && <button type="button" onClick={() => revokeLink(link.id)} className="text-red-600 underline">Revoke</button>}
        </div>)}
      </div>
    </section>
  );
}