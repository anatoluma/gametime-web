"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

// ... [Keep your existing Types and Logic at the top] ...

export default function PlayerPage() {
  // ... [Keep your existing useEffect and loading logic] ...

  return (
    <main className="p-4 max-w-2xl mx-auto bg-gray-50 min-h-screen">
      {/* Header Section - Matches your current Pro look */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-orange-600 font-black text-xl">#{player.jersey_number ?? "?"}</span>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter leading-none">
              {player.first_name}<br />{player.last_name}
            </h1>
            <Link href={`/teams/${player.team_id}`} className="text-sm font-bold text-gray-400 uppercase mt-2 block hover:text-orange-600 transition-colors">
              {team?.team_name ?? player.team_id}
            </Link>
          </div>
          <div className="bg-orange-50 px-4 py-2 rounded-xl text-center border border-orange-100">
            <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest">PPG</div>
            <div className="text-2xl font-black text-orange-600">{ppg}</div>
          </div>
        </div>

        {/* GP and Total Points Row */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-50">
          <div className="text-center">
            <div className="text-[10px] font-bold text-gray-400 uppercase">Games</div>
            <div className="text-lg font-black text-gray-900">{stats.length}</div>
          </div>
          <div className="text-center border-l">
            <div className="text-[10px] font-bold text-gray-400 uppercase">Total Points</div>
            <div className="text-lg font-black text-gray-900">{totalPoints}</div>
          </div>
        </div>
      </div>

      <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Game Log</h2>

      {/* REPLACED TABLE WITH FLEX LIST */}
      <div className="space-y-3">
        {rows.map((s) => {
          const g = gamesById[s.game_id];
          if (!g) return null;

          const isHome = g.home_team_id === player.team_id;
          const opponent = isHome ? g.away_team_id : g.home_team_id;
          
          let resultChar = "—";
          let resultColor = "text-gray-300";
          if (g.home_score !== null && g.away_score !== null) {
            const playerTeamScore = isHome ? g.home_score : g.away_score;
            const opponentScore = isHome ? g.away_score : g.home_score;
            if (playerTeamScore > opponentScore) { resultChar = "W"; resultColor = "text-green-600"; }
            else if (playerTeamScore < opponentScore) { resultChar = "L"; resultColor = "text-red-600"; }
          }

          const dateObj = g.tipoff ? new Date(g.tipoff) : null;
          const formattedDate = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "TBD";

          return (
            <div key={s.game_id} className="bg-white border rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                {/* Date & Result */}
                <div className="text-center min-w-[45px]">
                  <div className="text-[10px] font-black text-gray-300 uppercase leading-none mb-1">{formattedDate}</div>
                  <div className={`text-xl font-black ${resultColor} leading-none`}>{resultChar}</div>
                </div>
                
                {/* Opponent & Score */}
                <div className="border-l pl-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                    {isHome ? "vs" : "@"} {opponent}
                  </div>
                  <div className="text-xs font-bold text-gray-600">{g.home_score}-{g.away_score}</div>
                </div>
              </div>

              {/* Points - Pinned to the Right */}
              <div className="text-right">
                <div className="text-[10px] font-black text-orange-400 uppercase leading-none mb-1">PTS</div>
                <div className="text-2xl font-black text-gray-900 leading-none">{s.points ?? 0}</div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}