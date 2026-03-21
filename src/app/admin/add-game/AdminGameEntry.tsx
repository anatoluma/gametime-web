"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";

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

  // Form State
  const [gameData, setGameData] = useState({
    home_team_id: "",
    away_team_id: "",
    tipoff: "",
    venue: "",
    season: "",
    home_score: 0,
    away_score: 0
  });

  // 1. Load Teams + existing games on Mount
  useEffect(() => {
    async function init() {
      const { data: teamsData } = await supabase.from("teams").select("*").order("team_name");
      if (teamsData) setTeams(teamsData);

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
      venue: "",
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
      venue: game.venue ?? "",
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
      home?.map(p => ({
        ...p,
        played: Boolean(mapStat[p.player_id]),
        points: mapStat[p.player_id]?.points ?? 0
      })) || []
    );

    setAwayPlayers(
      away?.map(p => ({
        ...p,
        played: Boolean(mapStat[p.player_id]),
        points: mapStat[p.player_id]?.points ?? 0
      })) || []
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
      venue: gameData.venue,
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
    <main className="p-6 max-w-4xl mx-auto bg-white min-h-screen text-black">
      <h1 className="text-4xl font-black italic uppercase mb-8 border-b-4 border-black pb-2">Admin: Game Entry</h1>

      {/* STEP 1: GAME INFO */}
      {step === 1 && (
        <section className="space-y-6">
          {showEditDropdown ? (
            <div className="flex flex-col gap-3">
              <label className="block text-[10px] font-black uppercase mb-1 text-zinc-500 tracking-widest">
                Edit existing game
              </label>
              <div className="flex gap-2">
                <select
                  className="flex-1 border-4 border-black p-3 font-bold bg-white text-black"
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
                    className="px-4 py-3 border-4 border-black font-black uppercase bg-white hover:bg-zinc-100"
                  >
                    New
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500">
                Tip: you can also open a game directly via <code className="bg-zinc-100 px-1 rounded">/admin/edit-game?edit=&lt;GAME_ID&gt;</code>
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date & Time Picker */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-[10px] font-black uppercase mb-1 text-zinc-500 tracking-widest">
                Game Date & Time
              </label>
              <input 
                type="datetime-local" 
                className="w-full border-4 border-black p-3 font-black text-xl uppercase bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:shadow-none transition-all"
                value={gameData.tipoff}
                onChange={(e) => setGameData({...gameData, tipoff: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase mb-1 text-zinc-500 tracking-widest">Season</label>
              <input
                type="text"
                className="w-full border-4 border-black p-3 font-bold bg-white text-black"
                value={gameData.season || computeSeasonFromTipoff(gameData.tipoff)}
                placeholder="e.g. 2025/26"
                onChange={(e) => setGameData({...gameData, season: e.target.value})}
              />
              <p className="text-[10px] text-zinc-500 mt-1">If blank, season is computed from the game date.</p>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase mb-1 text-zinc-500 tracking-widest">Home Team</label>
              <select 
                className="w-full border-4 border-black p-3 font-bold bg-white text-black"
                onChange={(e) => setGameData({...gameData, home_team_id: e.target.value})}
              >
                <option value="">Select Home</option>
                {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase mb-1 text-zinc-500 tracking-widest">Away Team</label>
              <select 
                className="w-full border-4 border-black p-3 font-bold bg-white text-black"
                onChange={(e) => setGameData({...gameData, away_team_id: e.target.value})}
              >
                <option value="">Select Away</option>
                {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
              </select>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-[10px] font-black uppercase mb-1 text-zinc-500 tracking-widest">Venue / Place</label>
              <input 
                type="text"
                placeholder="e.g. Sala Polivalenta"
                className="w-full border-4 border-black p-3 font-bold bg-white text-black"
                value={gameData.venue}
                onChange={(e) => setGameData({...gameData, venue: e.target.value})}
              />
            </div>
          </div>

          <button 
            onClick={() => loadRosters()}
            disabled={!gameData.home_team_id || !gameData.away_team_id || !gameData.tipoff}
            className="w-full bg-black text-white font-black py-4 uppercase italic text-xl hover:bg-orange-600 disabled:bg-zinc-200 disabled:text-zinc-400 transition-all border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1"
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
              className="bg-white border-4 border-black text-black font-black py-3 px-6 uppercase italic hover:bg-zinc-100"
            >
              Back to Game Info
            </button>
            {editingGameId && (
              <span className="text-sm font-black uppercase tracking-wide text-zinc-600">
                Editing game: {editingGameId}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Home Stats */}
            <TeamStatEntry title="Home Roster" players={homePlayers} setPlayers={setHomePlayers} />
            {/* Away Stats */}
            <TeamStatEntry title="Away Roster" players={awayPlayers} setPlayers={setAwayPlayers} />
          </div>

          <button 
            onClick={handleSaveGame}
            className="w-full bg-orange-600 text-white font-black py-6 uppercase italic text-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          >
            Finalize & Save Game
          </button>
        </section>
      )}
    </main>
  );
}

// Sub-component for Team Stats
function TeamStatEntry({ title, players, setPlayers }: any) {
  const updatePlayer = (id: string, field: string, value: any) => {
    setPlayers(players.map((p: any) => p.player_id === id ? { ...p, [field]: value } : p));
  };

  return (
    <div className="border-2 border-black p-4 rounded-xl">
      <h3 className="font-black uppercase italic mb-4 border-b-2 border-black pb-1">{title}</h3>
      <div className="space-y-2">
        {players.map((p: any) => (
          <div key={p.player_id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={p.played}
              onChange={(e) => updatePlayer(p.player_id, 'played', e.target.checked)}
              className="w-5 h-5 accent-orange-600"
            />
            <span className="w-12 text-sm font-black">
              #{p.jersey_number ?? p.number ?? p.shirt_number ?? "-"}
            </span>
            <span className="flex-1 font-bold text-sm truncate">{p.first_name} {p.last_name}</span>
            {p.played && (
              <input
                type="number"
                placeholder="PTS"
                value={p.points || ""}
                className="w-16 border-2 border-black p-1 text-center font-black"
                onChange={(e) => updatePlayer(p.player_id, 'points', parseInt(e.target.value) || 0)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
