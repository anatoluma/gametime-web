"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";

type NewPlayerInput = {
  first_name: string;
  last_name: string;
  jersey_number: number | null;
};

export default function AdminGameEntry({
  showEditDropdown = false,
  initialEditId,
}: {
  showEditDropdown?: boolean;
  initialEditId?: string;
}) {
  const [step, setStep] = useState(1);
  const [teams, setTeams] = useState<any[]>([]);
  const [existingGames, setExistingGames] = useState<any[]>([]);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
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
        .select("game_id, home_team_id, away_team_id, tipoff, season, venue")
        .order("tipoff", { ascending: false });
      if (gamesData) setExistingGames(gamesData);

      if (initialEditId) {
        await loadExistingGame(initialEditId);
      }
    }
    init();
  }, [initialEditId]);

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

  const resetToNewGame = () => {
    setEditingGameId(null);
    setGameData({
      home_team_id: "",
      away_team_id: "",
      tipoff: "",
      season: "",
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

    const resp = await fetch(`/api/admin/game?game_id=${encodeURIComponent(gameId)}`);
    const data = await resp.json();

    if (!resp.ok || data.error) {
      alert(`Could not load selected game: ${data?.error || resp.statusText}`);
      return;
    }

    const { game, stats } = data;

    setGameData({
      home_team_id: game.home_team_id,
      away_team_id: game.away_team_id,
      tipoff: game.tipoff ?? "",
      season: game.season ?? "",
      home_score: game.home_score ?? 0,
      away_score: game.away_score ?? 0
    });

    const statsMap = Object.fromEntries((stats ?? []).map((s: any) => [s.player_id, s]));

    await loadRosters(game.home_team_id, game.away_team_id, statsMap);
  };

  const loadRosters = async (
    homeTeamId?: string,
    awayTeamId?: string,
    statsByPlayerId?: Record<string, any>
  ) => {
    const homeId = homeTeamId ?? gameData.home_team_id;
    const awayId = awayTeamId ?? gameData.away_team_id;

    const { data: home } = await supabase.from("players").select("*").eq("team_id", homeId);
    const { data: away } = await supabase.from("players").select("*").eq("team_id", awayId);

    const mapStat = statsByPlayerId ?? {};

    setHomePlayers(
      sortRoster(
        (home
          ?.map(p => ({
            ...p,
            played: Boolean(mapStat[p.player_id]),
            points: mapStat[p.player_id]?.points ?? 0
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
            points: mapStat[p.player_id]?.points ?? 0
          }))
        ) || []
      )
    );

    setStep(2);
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
  ) => {
    const response = await fetch("/api/admin/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId, ...payload }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result?.error || response.statusText || "Failed to create player");
    }

    const player = result.player;

    setPlayers((prev: any[]) =>
      sortRoster([
        ...prev,
        {
          ...player,
          played: true,
          points: 0,
        },
      ])
    );
  };

  const handleSaveGame = async () => {
    // 1. Compute the final scores from player totals
    const homeScore = homePlayers.filter(p => p.played).reduce((sum, p) => sum + (p.points || 0), 0);
    const awayScore = awayPlayers.filter(p => p.played).reduce((sum, p) => sum + (p.points || 0), 0);

    const season = gameData.season || computeSeasonFromTipoff(gameData.tipoff) || "2025/26";

    // 2. Prepare the game record data
    const gamePayload = {
      home_team_id: gameData.home_team_id,
      away_team_id: gameData.away_team_id,
      tipoff: new Date(gameData.tipoff).toISOString(),
      venue: getVenueFromHomeTeam(gameData.home_team_id),
      season,
      home_score: homeScore,
      away_score: awayScore
    };

    const gameId = editingGameId ?? crypto.randomUUID();

    const response = await fetch("/api/admin/game", {
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
                  <option value="">+ New game</option>
                  {existingGames.map(g => (
                    <option key={g.game_id} value={g.game_id}>{getGameLabel(g)}</option>
                  ))}
                </select>
                {editingGameId && (
                  <button
                    type="button"
                    onClick={resetToNewGame}
                    className="px-4 py-3 rounded-lg border border-[var(--border)] font-semibold bg-[var(--surface)] hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    New
                  </button>
                )}
              </div>
            </div>
          ) : null}

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
                onChange={(e) => setGameData({...gameData, home_team_id: e.target.value})}
              >
                <option value="">Select Home</option>
                {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--text-muted)] tracking-wide">Away Team</label>
              <select 
                className="w-full rounded-lg border border-[var(--border)] p-3 font-medium bg-[var(--surface)] text-[var(--foreground)]"
                onChange={(e) => setGameData({...gameData, away_team_id: e.target.value})}
              >
                <option value="">Select Away</option>
                {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
              </select>
            </div>

          </div>

          <button 
            onClick={() => loadRosters()}
            disabled={!gameData.home_team_id || !gameData.away_team_id || !gameData.tipoff}
            className="w-full rounded-lg bg-[var(--accent)] text-white font-semibold py-3.5 text-base hover:brightness-95 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
          >
            Load Rosters & Continue
          </button>
        </section>
      )}
      {/* STEP 2: ROSTERS & STATS */}
      {step === 2 && (
        <section className="space-y-8">
          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] font-medium py-2.5 px-4 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Back to Game Info
            </button>
            {editingGameId && (
              <span className="text-sm font-medium tracking-wide text-[var(--text-muted)]">
                Editing game: {editingGameId}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Home Stats */}
            <TeamStatEntry
              title="Home Roster"
              teamId={gameData.home_team_id}
              players={homePlayers}
              setPlayers={setHomePlayers}
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
              onCreatePlayer={(payload: NewPlayerInput) =>
                handleCreatePlayer(gameData.away_team_id, payload, setAwayPlayers)
              }
            />
          </div>

          <button 
            onClick={handleSaveGame}
            className="w-full rounded-lg bg-[var(--accent-strong)] text-white font-semibold py-4 text-lg hover:brightness-95 transition-colors"
          >
            Finalize & Save Game
          </button>
        </section>
      )}
    </main>
  );
}

// Sub-component for Team Stats
function TeamStatEntry({ title, teamId, players, setPlayers, onCreatePlayer }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    first_name: "",
    last_name: "",
    jersey_number: "",
  });

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
      await onCreatePlayer({
        first_name: firstName,
        last_name: lastName,
        jersey_number: parsedJersey,
      });
      setIsAdding(false);
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
            onClick={() => setIsAdding((prev) => !prev)}
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
              onChange={(e) => setNewPlayer((prev) => ({ ...prev, jersey_number: e.target.value }))}
              className="rounded-md border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)]"
            />
          </div>
          <button
            type="button"
            onClick={handleCreatePlayerSubmit}
            disabled={isSavingPlayer}
            className="rounded-md bg-[var(--accent)] text-white px-3 py-2 text-sm font-semibold hover:brightness-95 disabled:opacity-60"
          >
            {isSavingPlayer ? "Adding..." : "Add To Roster"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {players.map((p: any) => (
          <div key={p.player_id} className="flex items-center gap-3">
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
            {p.played && (
              <input
                type="number"
                placeholder="PTS"
                value={p.points || ""}
                className="w-16 rounded-md border border-[var(--border)] p-1 text-center font-semibold bg-[var(--surface)] text-[var(--foreground)]"
                onChange={(e) => updatePlayer(p.player_id, 'points', parseInt(e.target.value) || 0)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
