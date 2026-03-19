"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AdminGameEntry() {
  const [step, setStep] = useState(1);
  const [teams, setTeams] = useState<any[]>([]);
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

  // 1. Load Teams on Mount
  useEffect(() => {
    async function getTeams() {
      const { data } = await supabase.from("teams").select("*").order("team_name");
      if (data) setTeams(data);
    }
    getTeams();
  }, []);

  // 2. Load Players when teams are selected
  const loadRosters = async () => {
    const { data: home } = await supabase.from("players").select("*").eq("team_id", gameData.home_team_id);
    const { data: away } = await supabase.from("players").select("*").eq("team_id", gameData.away_team_id);
    setHomePlayers(home?.map(p => ({ ...p, played: false, points: 0 })) || []);
    setAwayPlayers(away?.map(p => ({ ...p, played: false, points: 0 })) || []);
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
    // 1. Create the game record first
    // NOTE: The games table requires non-null `game_id` and `season`.
    // Generate a UUID so we can link player stats to it.
    const newGameId = crypto.randomUUID();

    // Calculate final scores from player points (instead of relying on manual input)
    const homeScore = homePlayers.filter(p => p.played).reduce((sum, p) => sum + (p.points || 0), 0);
    const awayScore = awayPlayers.filter(p => p.played).reduce((sum, p) => sum + (p.points || 0), 0);

    const season = gameData.season || computeSeasonFromTipoff(gameData.tipoff) || "2025/26";

    const { data: game, error: gError } = await supabase
      .from("games")
      .insert([{
        game_id: newGameId,
        home_team_id: gameData.home_team_id,
        away_team_id: gameData.away_team_id,
        tipoff: new Date(gameData.tipoff).toISOString(),
        venue: gameData.venue,
        season,
        home_score: homeScore,
        away_score: awayScore
      }])
      .select()
      .single();

    if (gError) return alert(`Game Error: ${gError.message}`);
    if (!game) return alert("Game Error: Failed to create game record.");

    // 2. Now use the generated ID for the stats
    const gameId = game.game_id ?? newGameId;

    const allStats = [...homePlayers, ...awayPlayers]
      .filter(p => p.played)
      .map(p => ({
        game_id: gameId,
        player_id: p.player_id,
        points: p.points,
        team_id: p.team_id
      }));

    const { error: sError } = await supabase.from("player_game_stats").insert(allStats);
    
    if (sError) {
      alert(`Stats Error: ${sError.message}`);
    } else {
      alert("Success! Game and Stats uploaded.");
      window.location.reload();
    }
  };

  return (
    <main className="p-6 max-w-4xl mx-auto bg-white min-h-screen text-black">
      <h1 className="text-4xl font-black italic uppercase mb-8 border-b-4 border-black pb-2">Admin: Game Entry</h1>

      {/* STEP 1: GAME INFO */}
      {step === 1 && (
        <section className="space-y-6">
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
            onClick={loadRosters}
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
            <span className="flex-1 font-bold text-sm truncate">{p.first_name} {p.last_name}</span>
            {p.played && (
              <input 
                type="number" 
                placeholder="PTS"
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