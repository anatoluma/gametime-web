"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { normalizeSeasonLabel } from "@/lib/league";
import { adminFetch } from "@/lib/admin-fetch";
import type { RosterEntry } from "@/lib/commit-integrity";
import type { JerseyConflict } from "@/lib/manual-player";

type NewPlayerInput = {
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  replace_jersey_for?: string;
  use_existing_player?: string;
};

type PlayerCreationResult = { conflict: JerseyConflict } | { conflict: null };

type Team = {
  team_id: string;
  team_name: string | null;
};

export default function AdminGameEntry({
  showEditDropdown = false,
  initialEditId,
}: {
  showEditDropdown?: boolean;
  initialEditId?: string;
}) {
  const [step, setStep] = useState(1);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeams, setActiveTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [existingGames, setExistingGames] = useState<any[]>([]);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [savingVideo, setSavingVideo] = useState(false);
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);

  const sortRoster = (players: any[]) => {
    return [...players].sort(
      (a, b) => (a.jersey_number ?? a.number ?? 0) - (b.jersey_number ?? b.number ?? 0)
    );
  };

  // Form State
  const [gameData, setGameData] = useState({
    home_team_id: "",
    away_team_id: "",
    tipoff: "",
    season: "",
    venue: "",
    home_score: 0,
    away_score: 0
  });

  // 1. Load Teams + existing games on Mount
  useEffect(() => {
    async function init() {
      const { data: teamsData } = await supabase.from("teams").select("*").order("team_name");
      if (teamsData) setTeams(teamsData.filter(t => !["VET", "ALU"].includes(t.team_id)));

      const { data: gamesData } = await supabase
        .from("games")
        .select("game_id, home_team_id, away_team_id, tipoff, season, venue, home_score, away_score")
        .order("tipoff", { ascending: false });
      if (gamesData) setExistingGames(gamesData);

      if (initialEditId) {
        await loadExistingGame(initialEditId);
      }
    }
    init();
  }, [initialEditId]);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveTeams() {
      try {
        const seasonsRes = await adminFetch("/api/admin/seasons");
        if (!seasonsRes.ok) throw new Error("Could not load seasons.");
        const seasonsData: { seasons: { season: string; is_current: boolean }[] } = await seasonsRes.json();
        const currentSeason = seasonsData.seasons.find((season) => season.is_current)?.season
          || seasonsData.seasons[0]?.season;
        if (!currentSeason) throw new Error("No season found.");

        const teamsRes = await adminFetch(`/api/admin/teams?season=${encodeURIComponent(currentSeason)}`);
        if (!teamsRes.ok) throw new Error("Could not load teams for the current season.");
        const teamsData: { teams: (Team & { is_active: boolean })[] } = await teamsRes.json();
        if (!cancelled) setActiveTeams(teamsData.teams.filter((team) => team.is_active !== false));
      } catch (error) {
        if (!cancelled) setTeamsError(error instanceof Error ? error.message : "Could not load teams.");
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    }

    loadActiveTeams();
    return () => { cancelled = true; };
  }, []);

  const teamsById = useMemo(() => {
    return Object.fromEntries(teams.map(t => [t.team_id, t.team_name]));
  }, [teams]);

  const getGameLabel = (game: any) => {
    const home = teamsById[game.home_team_id] ?? game.home_team_id;
    const away = teamsById[game.away_team_id] ?? game.away_team_id;
    const date = game.tipoff ? new Date(game.tipoff).toLocaleString() : "(no date)";
    const season = game.season ? ` ${game.season}` : "";
    return `${home} vs ${away} — ${date}${season}`;
  };

  // Scheduled future fixtures would otherwise bury the games that were actually played.
  const { recentGames, otherGames } = useMemo(() => {
    const now = Date.now();
    const recent = existingGames
      .filter(g => g.tipoff && new Date(g.tipoff).getTime() <= now)
      .slice(0, 10);
    const recentIds = new Set(recent.map(g => g.game_id));
    return { recentGames: recent, otherGames: existingGames.filter(g => !recentIds.has(g.game_id)) };
  }, [existingGames]);

  const saveYoutubeUrl = async () => {
    if (!editingGameId) return;
    setSavingVideo(true);
    try {
      const resp = await adminFetch("/api/admin/game", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: editingGameId, youtube_url: youtubeUrl }),
      });
      const result = await resp.json();
      if (!resp.ok || result.error) {
        alert(`YouTube link error: ${result?.error || resp.statusText}`);
        return;
      }
      setYoutubeUrl(result.youtube_url ?? "");
      alert(result.youtube_url ? "YouTube link saved." : "YouTube link removed.");
    } finally {
      setSavingVideo(false);
    }
  };

  const resetToNewGame = () => {
    setEditingGameId(null);
    setYoutubeUrl("");
    setGameData({
      home_team_id: "",
      away_team_id: "",
      tipoff: "",
      season: "",
      venue: "",
      home_score: 0,
      away_score: 0
    });
    setHomePlayers([]);
    setAwayPlayers([]);
    setStep(1);
  };

  const loadExistingGame = async (gameId: string) => {
    if (!gameId) return resetToNewGame();
    setEditingGameId(gameId);

    const resp = await adminFetch(`/api/admin/game?game_id=${encodeURIComponent(gameId)}`);
    const data = await resp.json();

    if (!resp.ok || data.error) {
      alert(`Could not load selected game: ${data?.error || resp.statusText}`);
      return;
    }

    const { game, stats } = data;
    setYoutubeUrl(game.youtube_url ?? "");

    setGameData({
      home_team_id: game.home_team_id,
      away_team_id: game.away_team_id,
      tipoff: game.tipoff ?? "",
      season: game.season ?? "",
      venue: game.venue ?? "",
      home_score: game.home_score ?? 0,
      away_score: game.away_score ?? 0
    });

    const statsMap = Object.fromEntries((stats ?? []).map((s: any) => [s.player_id, s]));

    await loadRosters(game.home_team_id, game.away_team_id, statsMap, game.season);
  };

  const loadRosters = async (
    homeTeamId?: string,
    awayTeamId?: string,
    statsByPlayerId?: Record<string, any>,
    gameSeason?: string
  ) => {
    const homeId = homeTeamId ?? gameData.home_team_id;
    const awayId = awayTeamId ?? gameData.away_team_id;
    const season = normalizeSeasonLabel(gameSeason || gameData.season || computeSeasonFromTipoff(gameData.tipoff));
    const mapStat = statsByPlayerId ?? (editingGameId
      ? Object.fromEntries([...homePlayers, ...awayPlayers].filter((p) => p.played).map((p) => [p.player_id, p]))
      : {});
    try {
      const params = new URLSearchParams({ season });
      params.append("team_id", homeId);
      params.append("team_id", awayId);
      const response = await adminFetch(`/api/admin/rosters?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load rosters.");
      if (!Array.isArray(result.roster)) throw new Error("The roster response was invalid.");
      const roster: RosterEntry[] = result.roster;
      for (let i = roster.length - 1; i >= 0; i--) {
        const stat = mapStat[roster[i].player_id];
        if (stat && stat.team_id !== roster[i].team_id) roster.splice(i, 1);
      }
      const missingIds = Object.keys(mapStat).filter((id) => !roster.some((p) => p.player_id === id));
      if (missingIds.length) {
        const { data, error } = await supabase.from("players")
          .select("player_id, first_name, last_name, jersey_number").in("player_id", missingIds);
        if (error) throw new Error(`Could not load game participants: ${error.message}`);
        if ((data ?? []).length !== missingIds.length) throw new Error("Some existing game participants could not be loaded.");
        for (const player of data ?? []) {
          const teamId = mapStat[player.player_id].team_id;
          if (teamId !== homeId && teamId !== awayId) throw new Error("An existing game participant belongs to another team.");
          roster.push({ ...player, team_id: teamId });
        }
      }
      const home = roster.filter((player) => player.team_id === homeId);
      const away = roster.filter((player) => player.team_id === awayId);

      setHomePlayers(
        sortRoster(
          (home
            ?.map(p => ({
              ...p,
              played: Boolean(mapStat[p.player_id]),
              points: mapStat[p.player_id]?.points ?? 0,
              is_starter: mapStat[p.player_id]?.is_starter ?? null,
              minutes: mapStat[p.player_id]?.minutes ?? null,
              two_made: mapStat[p.player_id]?.two_made ?? null,
              two_att: mapStat[p.player_id]?.two_att ?? null,
              three_made: mapStat[p.player_id]?.three_made ?? null,
              three_att: mapStat[p.player_id]?.three_att ?? null,
              ft_made: mapStat[p.player_id]?.ft_made ?? null,
              ft_att: mapStat[p.player_id]?.ft_att ?? null,
              reb_off: mapStat[p.player_id]?.reb_off ?? null,
              reb_def: mapStat[p.player_id]?.reb_def ?? null,
              reb_tot: mapStat[p.player_id]?.reb_tot ?? null,
              assists: mapStat[p.player_id]?.assists ?? null,
              turnovers: mapStat[p.player_id]?.turnovers ?? null,
              steals: mapStat[p.player_id]?.steals ?? null,
              blocks: mapStat[p.player_id]?.blocks ?? null,
              fouls_personal: mapStat[p.player_id]?.fouls_personal ?? null,
              plus_minus: mapStat[p.player_id]?.plus_minus ?? null,
              efficiency: mapStat[p.player_id]?.efficiency ?? null,
            }))
          ) || []
        )
      );

      setAwayPlayers(
        sortRoster(
          (away
            ?.map(p => ({
              ...p,
              played: Boolean(mapStat[p.player_id]),
              points: mapStat[p.player_id]?.points ?? 0,
              is_starter: mapStat[p.player_id]?.is_starter ?? null,
              minutes: mapStat[p.player_id]?.minutes ?? null,
              two_made: mapStat[p.player_id]?.two_made ?? null,
              two_att: mapStat[p.player_id]?.two_att ?? null,
              three_made: mapStat[p.player_id]?.three_made ?? null,
              three_att: mapStat[p.player_id]?.three_att ?? null,
              ft_made: mapStat[p.player_id]?.ft_made ?? null,
              ft_att: mapStat[p.player_id]?.ft_att ?? null,
              reb_off: mapStat[p.player_id]?.reb_off ?? null,
              reb_def: mapStat[p.player_id]?.reb_def ?? null,
              reb_tot: mapStat[p.player_id]?.reb_tot ?? null,
              assists: mapStat[p.player_id]?.assists ?? null,
              turnovers: mapStat[p.player_id]?.turnovers ?? null,
              steals: mapStat[p.player_id]?.steals ?? null,
              blocks: mapStat[p.player_id]?.blocks ?? null,
              fouls_personal: mapStat[p.player_id]?.fouls_personal ?? null,
              plus_minus: mapStat[p.player_id]?.plus_minus ?? null,
              efficiency: mapStat[p.player_id]?.efficiency ?? null,
            }))
          ) || []
        )
      );

      setStep(2);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not load rosters.");
    }
  };

  const computeSeasonFromTipoff = (tipoffIso: string) => {
    if (!tipoffIso) return "";
    const d = new Date(tipoffIso);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-based

    // Season spans across calendar years (e.g., 2025/26)
    // If month is Aug-Dec, we treat it as the start of a season.
    // If month is Jan-Jul, treat it as the second half of the previous season.
    const startYear = month >= 8 ? year : year - 1;
    const endYearShort = String(startYear + 1).slice(-2);
    return `${startYear}/${endYearShort}`;
  };

  const getVenueFromHomeTeam = (homeTeamId: string) => {
    switch ((homeTeamId || "").toUpperCase()) {
      case "BRI":
        return "Briceni";
      case "HAI":
        return "Blijnii Hutor";
      case "MET":
        return "Ribnita";
      case "DRO":
        return "Drochia";
      default:
        return "Edilitate";
    }
  };

  const handleCreatePlayer = async (
    teamId: string,
    payload: NewPlayerInput,
    setPlayers: React.Dispatch<React.SetStateAction<any[]>>
  ): Promise<PlayerCreationResult> => {
    const season = normalizeSeasonLabel(gameData.season || computeSeasonFromTipoff(gameData.tipoff));
    if (!/^\d{4}\/\d{2}$/.test(season)) {
      throw new Error("Set a valid game date and season before adding a player.");
    }
    const response = await adminFetch("/api/admin/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId, season, ...payload }),
    });

    const result = await response.json();

    if (response.status === 409 && result.conflict) return { conflict: result.conflict as JerseyConflict };
    if (!response.ok || result.error) {
      throw new Error(result?.error || response.statusText || "Failed to create player");
    }

    const player = result.player;

    setPlayers((prev: any[]) =>
      sortRoster([
        ...prev.map((p) => p.player_id === payload.replace_jersey_for ? { ...p, jersey_number: null } : p),
        ...(!payload.use_existing_player || !prev.some((p) => p.player_id === player.player_id) ? [{
          ...player,
          played: true,
          points: 0,
        }] : []),
      ].map((p) => p.player_id === payload.use_existing_player ? { ...p, played: true } : p))
    );
    return { conflict: null };
  };

  const handleSaveGame = async () => {
    // 1. Compute the final scores from player totals
    const homeScore = homePlayers.filter(p => p.played).reduce((sum, p) => sum + (p.points || 0), 0);
    const awayScore = awayPlayers.filter(p => p.played).reduce((sum, p) => sum + (p.points || 0), 0);

    const season = normalizeSeasonLabel(gameData.season || computeSeasonFromTipoff(gameData.tipoff) || "2025/26");

    // 2. Prepare the game record data
    const gamePayload = {
      home_team_id: gameData.home_team_id,
      away_team_id: gameData.away_team_id,
      tipoff: new Date(gameData.tipoff).toISOString(),
      venue: gameData.venue || getVenueFromHomeTeam(gameData.home_team_id),
      season,
      home_score: homeScore,
      away_score: awayScore
    };

    const generateGameId = (tipoff: string, homeTeamId: string, awayTeamId: string) => {
      const d = new Date(tipoff);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `g_${y}_${m}_${day}_${homeTeamId}_${awayTeamId}`;
    };

    const gameId = editingGameId ?? generateGameId(gameData.tipoff, gameData.home_team_id, gameData.away_team_id);

    const response = await adminFetch("/api/admin/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gamePayload: { ...gamePayload, game_id: gameId },
        homePlayers,
        awayPlayers,
        editingGameId,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      alert(`Game Error: ${result?.error || response.statusText}`);
      return;
    }

    alert("Success! Game and Stats uploaded.");
    window.location.reload();
  };

  const handleDeleteGame = async () => {
    if (!editingGameId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete this game? This action cannot be undone.\n\nGame: ${getGameLabel(existingGames.find(g => g.game_id === editingGameId))}`
    );

    if (!confirmed) return;

    const response = await adminFetch(`/api/admin/game?game_id=${encodeURIComponent(editingGameId)}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      alert(`Delete Error: ${result?.error || response.statusText}`);
      return;
    }

    alert("Game deleted successfully!");
    window.location.reload();
  };

  const youtubePanel =
    showEditDropdown && editingGameId ? (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <label className="block text-xs font-semibold mb-1 text-[var(--text-muted)] tracking-wide">
          YouTube link (leave empty to remove)
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 rounded-lg border border-[var(--border)] p-3 font-medium bg-[var(--surface)] text-[var(--foreground)]"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
          />
          <button
            type="button"
            disabled={savingVideo}
            onClick={saveYoutubeUrl}
            className="px-4 py-3 rounded-lg bg-[var(--accent)] !text-white font-semibold hover:brightness-95 disabled:opacity-50"
          >
            {savingVideo ? "Saving…" : "Save link"}
          </button>
        </div>
      </div>
    ) : null;

  return (
    <main className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto min-h-screen text-[var(--foreground)] bg-[var(--surface)]">
      <h1 className="text-2xl sm:text-3xl font-semibold mb-8 pb-3 border-b border-[var(--border)]">
        Admin: Game Entry
      </h1>

      {/* STEP 1: GAME INFO */}
      {step === 1 && (
        <section className="space-y-6">
          {showEditDropdown ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <label className="block text-xs font-semibold mb-1 text-[var(--text-muted)] tracking-wide">
                Edit existing game
              </label>
              <div className="flex gap-2">
                <select
                  className="flex-1 rounded-lg border border-[var(--border)] p-3 font-medium bg-[var(--surface)] text-[var(--foreground)]"
                  value={editingGameId ?? ""}
                  onChange={(e) => loadExistingGame(e.target.value)}
                >
                  <option value="">Select game</option>
                  <optgroup label="Last 10 games">
                    {recentGames.map(g => (
                      <option key={g.game_id} value={g.game_id}>{getGameLabel(g)}</option>
                    ))}
                  </optgroup>
                  <optgroup label="All other games">
                    {otherGames.map(g => (
                      <option key={g.game_id} value={g.game_id}>{getGameLabel(g)}</option>
                    ))}
                  </optgroup>
                </select>
                {editingGameId && (
                  <>
                    <button
                      type="button"
                      onClick={resetToNewGame}
                      className="px-4 py-3 rounded-lg border border-[var(--border)] font-semibold bg-[var(--surface)] hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      New
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteGame}
                      className="px-4 py-3 rounded-lg border border-red-500 font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {youtubePanel}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date & Time Picker */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-semibold mb-1 text-[var(--text-muted)] tracking-wide">
                Game Date & Time
              </label>
              <input 
                type="datetime-local" 
                className="w-full rounded-lg border border-[var(--border)] p-3 text-base font-medium bg-[var(--surface)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                value={gameData.tipoff}
                onChange={(e) => {
                  const tipoffValue = e.target.value;
                  const computedSeason = computeSeasonFromTipoff(tipoffValue);
                  setGameData({...gameData, tipoff: tipoffValue, season: computedSeason});
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--text-muted)] tracking-wide">Home Team</label>
              <select 
                className="w-full rounded-lg border border-[var(--border)] p-3 font-medium bg-[var(--surface)] text-[var(--foreground)]"
                value={gameData.home_team_id}
                disabled={!editingGameId && (teamsLoading || !!teamsError)}
                onChange={(e) => setGameData({...gameData, home_team_id: e.target.value})}
              >
                <option value="">Select Home</option>
                {(editingGameId ? teams : activeTeams).map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--text-muted)] tracking-wide">Away Team</label>
              <select 
                className="w-full rounded-lg border border-[var(--border)] p-3 font-medium bg-[var(--surface)] text-[var(--foreground)]"
                value={gameData.away_team_id}
                disabled={!editingGameId && (teamsLoading || !!teamsError)}
                onChange={(e) => setGameData({...gameData, away_team_id: e.target.value})}
              >
                <option value="">Select Away</option>
                {(editingGameId ? teams : activeTeams).map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
              </select>
            </div>

          </div>

          {!editingGameId && teamsError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{teamsError}</p>
          )}

          <button 
            onClick={() => loadRosters()}
            disabled={!gameData.home_team_id || !gameData.away_team_id || !gameData.tipoff || (!editingGameId && (teamsLoading || !!teamsError))}
            className="w-full rounded-lg bg-[var(--accent)] !text-white font-semibold py-3.5 text-base hover:brightness-95 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
          >
            Load Rosters & Continue
          </button>
        </section>
      )}
      {/* STEP 2: ROSTERS & STATS */}
      {step === 2 && (
        <section className="space-y-8">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] font-medium py-2.5 px-4 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Back to Game Info
              </button>
              {editingGameId && (
                <button
                  type="button"
                  onClick={handleDeleteGame}
                  className="rounded-lg border border-red-500 font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 py-2.5 px-4"
                >
                  Delete Game
                </button>
              )}
            </div>
            {editingGameId && (
              <span className="text-sm font-medium tracking-wide text-[var(--text-muted)]">
                Editing game: {editingGameId}
              </span>
            )}
          </div>

          {/* Game Info Editing Section */}
          {youtubePanel}
          {editingGameId && (
            <div className="border border-[var(--border)] bg-[var(--surface-muted)] p-4 rounded-xl">
              <h3 className="font-semibold mb-4 pb-2 border-b border-[var(--border)]">Game Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[var(--text-muted)] tracking-wide">
                    Game Date & Time
                  </label>
                  <input 
                    type="datetime-local" 
                    className="w-full rounded-lg border border-[var(--border)] p-3 text-base font-medium bg-[var(--surface)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    value={gameData.tipoff}
                    onChange={(e) => {
                      const tipoffValue = e.target.value;
                      const computedSeason = computeSeasonFromTipoff(tipoffValue);
                      setGameData({...gameData, tipoff: tipoffValue, season: computedSeason});
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[var(--text-muted)] tracking-wide">
                    Season
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g., 2025/26"
                    className="w-full rounded-lg border border-[var(--border)] p-3 text-base font-medium bg-[var(--surface)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    value={gameData.season}
                    onChange={(e) => setGameData({...gameData, season: e.target.value})}
                    onBlur={(e) => setGameData({...gameData, season: normalizeSeasonLabel(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[var(--text-muted)] tracking-wide">
                    Venue
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g., Edilitate"
                    className="w-full rounded-lg border border-[var(--border)] p-3 text-base font-medium bg-[var(--surface)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    value={gameData.venue || getVenueFromHomeTeam(gameData.home_team_id)}
                    onChange={(e) => setGameData({...gameData, venue: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Home Stats */}
            <TeamStatEntry
              title="Home Roster"
              teamId={gameData.home_team_id}
              players={homePlayers}
              setPlayers={setHomePlayers}
              season={normalizeSeasonLabel(gameData.season || computeSeasonFromTipoff(gameData.tipoff))}
              pointsOnly={!editingGameId}
              onCreatePlayer={(payload: NewPlayerInput) =>
                handleCreatePlayer(gameData.home_team_id, payload, setHomePlayers)
              }
            />
            {/* Away Stats */}
            <TeamStatEntry
              title="Away Roster"
              teamId={gameData.away_team_id}
              players={awayPlayers}
              setPlayers={setAwayPlayers}
              season={normalizeSeasonLabel(gameData.season || computeSeasonFromTipoff(gameData.tipoff))}
              pointsOnly={!editingGameId}
              onCreatePlayer={(payload: NewPlayerInput) =>
                handleCreatePlayer(gameData.away_team_id, payload, setAwayPlayers)
              }
            />
          </div>

          <button 
            onClick={handleSaveGame}
            className="w-full rounded-lg bg-[var(--accent-strong)] !text-white font-semibold py-4 text-lg hover:brightness-95 transition-colors"
          >
            Finalize & Save Game
          </button>
        </section>
      )}
    </main>
  );
}

// Sub-component for Team Stats
function TeamStatEntry({ title, teamId, players, setPlayers, onCreatePlayer, pointsOnly, season }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    first_name: "",
    last_name: "",
    jersey_number: "",
  });
  const [conflict, setConflict] = useState<JerseyConflict | null>(null);
  const [conflictChoice, setConflictChoice] = useState<"existing" | "replace" | "different" | "">("");

  const updatePlayer = (id: string, field: string, value: any) => {
    setPlayers((prev: any[]) =>
      prev.map((p: any) => (p.player_id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleCreatePlayerSubmit = async () => {
    const firstName = newPlayer.first_name.trim();
    const lastName = newPlayer.last_name.trim();

    if (!teamId) {
      alert("Team is missing. Go back and select teams again.");
      return;
    }

    if (!firstName || !lastName) {
      alert("Please provide both first and last name.");
      return;
    }

    const jerseyNumber = newPlayer.jersey_number.trim();
    const parsedJersey = jerseyNumber === "" ? null : Number(jerseyNumber);

    if (jerseyNumber !== "" && Number.isNaN(parsedJersey)) {
      alert("Jersey number must be a valid number.");
      return;
    }

    setIsSavingPlayer(true);
    try {
      if (conflict && !conflictChoice) {
        alert("Choose how to resolve the jersey conflict.");
        return;
      }
      if (conflict && conflictChoice === "different") {
        alert("Change the jersey number above before adding the player.");
        return;
      }
      const result: PlayerCreationResult = await onCreatePlayer({
        first_name: firstName,
        last_name: lastName,
        jersey_number: parsedJersey,
        ...(conflict && conflictChoice === "replace" ? { replace_jersey_for: conflict.player_id } : {}),
        ...(conflict && conflictChoice === "existing" ? { use_existing_player: conflict.player_id } : {}),
      });
      if (result.conflict) {
        setConflict(result.conflict);
        setConflictChoice("");
        return;
      }
      setIsAdding(false);
      setConflict(null);
      setConflictChoice("");
      setNewPlayer({ first_name: "", last_name: "", jersey_number: "" });
    } catch (error: any) {
      alert(`Could not create player: ${error?.message || "Unknown error"}`);
    } finally {
      setIsSavingPlayer(false);
    }
  };

  const teamTotal = players
    .filter((p: any) => p.played)
    .reduce((sum: number, p: any) => sum + (p.points || 0), 0);

  return (
    <div className="border border-[var(--border)] bg-[var(--surface-muted)] p-4 rounded-xl">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-[var(--border)]">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setIsAdding((prev) => !prev); setConflict(null); setConflictChoice(""); }}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold bg-[var(--surface)] hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {isAdding ? "Cancel" : "+ Add Player"}
          </button>
          <div className="text-right">
            <p className="text-xs font-medium text-[var(--text-muted)]">Team Total</p>
            <p className="text-3xl font-semibold text-[var(--accent-strong)]">{teamTotal}</p>
          </div>
        </div>
      </div>

      {isAdding && (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-3">
          <p className="text-xs font-semibold text-[var(--text-muted)] tracking-wide">Create player for this team</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="First name"
              value={newPlayer.first_name}
              onChange={(e) => setNewPlayer((prev) => ({ ...prev, first_name: e.target.value }))}
              className="rounded-md border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)]"
            />
            <input
              type="text"
              placeholder="Last name"
              value={newPlayer.last_name}
              onChange={(e) => setNewPlayer((prev) => ({ ...prev, last_name: e.target.value }))}
              className="rounded-md border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)]"
            />
            <input
              type="number"
              placeholder="Jersey # (optional)"
              value={newPlayer.jersey_number}
              onChange={(e) => { setNewPlayer((prev) => ({ ...prev, jersey_number: e.target.value })); setConflict(null); setConflictChoice(""); }}
              className="rounded-md border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)]"
            />
          </div>
          {conflict && (
            <fieldset className="rounded border border-orange-300 bg-orange-50 dark:bg-orange-950/20 px-3 py-2 text-sm space-y-2">
              <legend className="font-semibold">Jersey #{conflict.jersey_number} is assigned to {[conflict.first_name, conflict.last_name].filter(Boolean).join(" ")}</legend>
              <label className="flex items-center gap-2"><input type="radio" name={`jersey-conflict-${teamId}`} checked={conflictChoice === "existing"} onChange={() => setConflictChoice("existing")} />Use existing player</label>
              <label className="flex items-center gap-2"><input type="radio" name={`jersey-conflict-${teamId}`} checked={conflictChoice === "replace"} onChange={() => setConflictChoice("replace")} />Add new player and remove the number from the existing player for this season and matching legacy record</label>
              <label className="flex items-center gap-2"><input type="radio" name={`jersey-conflict-${teamId}`} checked={conflictChoice === "different"} onChange={() => setConflictChoice("different")} />Use a different jersey number (edit the field above)</label>
            </fieldset>
          )}
          <button
            type="button"
            onClick={handleCreatePlayerSubmit}
            disabled={isSavingPlayer}
            className="rounded-md bg-[var(--accent)] !text-white px-3 py-2 text-sm font-semibold hover:brightness-95 disabled:opacity-60"
          >
            {isSavingPlayer ? "Adding..." : "Add To Roster"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {players.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No active players are registered for this team in {season}.</p>
        )}
        {players.map((p: any) => (
          <div key={p.player_id}>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={p.played}
                onChange={(e) => updatePlayer(p.player_id, 'played', e.target.checked)}
                className="w-5 h-5 accent-[var(--accent)]"
              />
              <span className="w-12 text-sm font-semibold text-[var(--text-muted)]">
                #{p.jersey_number ?? p.number ?? p.shirt_number ?? "-"}
              </span>
              <span className="flex-1 font-medium text-sm truncate">{p.first_name} {p.last_name}</span>
            </div>
            
            {p.played && (
              <div className="ml-7 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-3">
                {/* Basic Stats */}
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-muted)]">PTS</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={p.points || ""}
                    className="w-full rounded-md border border-[var(--border)] p-1 text-center text-sm bg-[var(--surface)] text-[var(--foreground)]"
                    onChange={(e) => updatePlayer(p.player_id, 'points', parseInt(e.target.value) || 0)}
                  />
                </div>
                
                {!pointsOnly && <><div className="flex flex-col">
                  <label className="text-xs text-[var(--text-muted)]">AST</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={p.assists || ""}
                    className="w-full rounded-md border border-[var(--border)] p-1 text-center text-sm bg-[var(--surface)] text-[var(--foreground)]"
                    onChange={(e) => updatePlayer(p.player_id, 'assists', parseInt(e.target.value) || 0)}
                  />
                </div>
                
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-muted)]">REB</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={p.reb_tot || ""}
                    className="w-full rounded-md border border-[var(--border)] p-1 text-center text-sm bg-[var(--surface)] text-[var(--foreground)]"
                    onChange={(e) => updatePlayer(p.player_id, 'reb_tot', parseInt(e.target.value) || 0)}
                  />
                </div>
                
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-muted)]">STL</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={p.steals || ""}
                    className="w-full rounded-md border border-[var(--border)] p-1 text-center text-sm bg-[var(--surface)] text-[var(--foreground)]"
                    onChange={(e) => updatePlayer(p.player_id, 'steals', parseInt(e.target.value) || 0)}
                  />
                </div>
                
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-muted)]">BLK</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={p.blocks || ""}
                    className="w-full rounded-md border border-[var(--border)] p-1 text-center text-sm bg-[var(--surface)] text-[var(--foreground)]"
                    onChange={(e) => updatePlayer(p.player_id, 'blocks', parseInt(e.target.value) || 0)}
                  />
                </div>
                
                <div className="flex flex-col">
                  <label className="text-xs text-[var(--text-muted)]">TO</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={p.turnovers || ""}
                    className="w-full rounded-md border border-[var(--border)] p-1 text-center text-sm bg-[var(--surface)] text-[var(--foreground)]"
                    onChange={(e) => updatePlayer(p.player_id, 'turnovers', parseInt(e.target.value) || 0)}
                  />
                </div>
                </>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
