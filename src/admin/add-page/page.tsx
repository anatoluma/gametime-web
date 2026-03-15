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

  const handleSaveGame = async () => {
    // 1. Insert Game
    const { data: game, error: gError } = await supabase
      .from("games")
      .insert([gameData])
      .select()
      .single();

    if (gError) return alert(gError.message);

    // 2. Insert Player Stats
    const allStats = [...homePlayers, ...awayPlayers]
      .filter(p => p.played)
      .map(p => ({
        game_id: game.game_id,
        player_id: p.player_id,
        points: p.points,
        team_id: p.team_id
      }));

    const { error: sError } = await supabase.from("player_game_stats").insert(allStats);
    
    if (!sError) {
      alert("Game and Stats uploaded successfully!");
      window.location.reload();
    }
  };

  return (
    <main className="p-6 max-w-4xl mx-auto bg-white min-h-screen text-black">
      <h1 className="text-4xl font-black italic uppercase mb-8 border-b-4 border-black pb-2">Admin: Game Entry</h1>

      {/* STEP 1: GAME INFO */}
      {step === 1 && (
        <section className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase mb-1">Home Team</label>
              <select 
                className="w-full border-2 border-black p-2 font-bold"
                onChange={(e) => setGameData({...gameData, home_team_id: e.target.value})}
              >
                <option value="">Select Team</option>
                {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Away Team</label>
              <select 
                className="w-full border-2 border-black p-2 font-bold"
                onChange={(e) => setGameData({...gameData, away_team_id: e.target.value})}
              >
                <option value="">Select Team</option>
                {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
              </select>
            </div>
          </div>
          <button 
            onClick={loadRosters}
            disabled={!gameData.home_team_id || !gameData.away_team_id}
            className="w-full bg-black text-white font-black py-4 uppercase italic hover:bg-orange-600 disabled:bg-gray-200 transition-colors"
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