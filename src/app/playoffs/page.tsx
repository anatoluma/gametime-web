"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TeamLogo from "@/app/components/TeamLogo";

// Real teams in Division B playoffs with current scores
const initialBracket = {
  quarterfinals: [
    { 
      team1: { id: "hitech", name: "HITECH SUCLEIA" }, 
      team2: { id: "brici", name: "BRICI BASKET" }, 
      team1Wins: 2, 
      team2Wins: 0, 
      games: [
        { id: "game1", homeScore: 85, awayScore: 78, finished: true },
        { id: "game2", homeScore: 88, awayScore: 82, finished: true }
      ]
    },
    { 
      team1: { id: "usmf", name: "USMF" }, 
      team2: { id: "blades", name: "BLADES" }, 
      team1Wins: 2, 
      team2Wins: 0, 
      games: [
        { id: "game3", homeScore: 82, awayScore: 78, finished: true },
        { id: "game4", homeScore: 90, awayScore: 85, finished: true }
      ]
    },
    { 
      team1: { id: "drochia", name: "DROCHIA BC" }, 
      team2: { id: "edin", name: "EDIN BASKET" }, 
      team1Wins: 2, 
      team2Wins: 0, 
      games: [
        { id: "game6", homeScore: 92, awayScore: 87, finished: true },
        { id: "game7", homeScore: 89, awayScore: 84, finished: true }
      ]
    },
    { 
      team1: { id: "gametime", name: "GAME TIME" }, 
      team2: { id: "white-wolves", name: "WHITE WOLVES" }, 
      team1Wins: 1, 
      team2Wins: 1, 
      games: [
        { id: "game8", homeScore: 76, awayScore: 79, finished: true },
        { id: "game9", homeScore: 83, awayScore: 80, finished: true }
      ]
    }
  ],
  semifinals: [
    { 
      team1: { id: "hitech", name: "HITECH SUCLEIA" }, 
      team2: { id: "usmf", name: "USMF" }, 
      team1Wins: 0, 
      team2Wins: 0, 
      games: []
    },
    { 
      team1: { id: "drochia", name: "DROCHIA BC" }, 
      team2: null, 
      team1Wins: 0, 
      team2Wins: 0, 
      games: []
    }
  ],
  finals: [
    { team1: null, team2: null, team1Wins: 0, team2Wins: 0, games: [] }
  ]
};

export default function PlayoffsPage() {
  const [bracket, setBracket] = useState(initialBracket);

  const getWinner = (matchup: any) => {
    if (matchup.team1Wins >= 2) return matchup.team1;
    if (matchup.team2Wins >= 2) return matchup.team2;
    return null;
  };

  const getMatchupStatus = (matchup: any) => {
    if (matchup.team1Wins >= 2) return `${matchup.team1?.name} wins series 2-${matchup.team2Wins}`;
    if (matchup.team2Wins >= 2) return `${matchup.team2?.name} wins series 2-${matchup.team1Wins}`;
    if (matchup.team1Wins > 0 || matchup.team2Wins > 0) return `Series tied ${matchup.team1Wins}-${matchup.team2Wins}`;
    return "Series not started";
  };

  const MatchupCard = ({ matchup, round, seeding }: { matchup: any; round: string; seeding?: { team1Seed: number; team2Seed: number } }) => {
    const winner = getWinner(matchup);
    
    // ESPN-style status text
    const getEspnStatus = (matchup: any) => {
      if (matchup.team1Wins >= 2) return `${matchup.team1?.name} wins series 2-${matchup.team2Wins}`;
      if (matchup.team2Wins >= 2) return `${matchup.team2?.name} wins series 2-${matchup.team1Wins}`;
      if (matchup.team1Wins > 0 || matchup.team2Wins > 0) {
        const leadingTeam = matchup.team1Wins > matchup.team2Wins ? matchup.team1?.name : matchup.team2?.name;
        const leadingScore = Math.max(matchup.team1Wins, matchup.team2Wins);
        const trailingScore = Math.min(matchup.team1Wins, matchup.team2Wins);
        const nextGame = matchup.games.length + 1;
        return `Game ${nextGame}, ${leadingTeam} leads ${leadingScore}-${trailingScore}`;
      }
      return "Game 1";
    };
    
    return (
      <div className="bg-white border-2 border-black rounded-lg p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all">
        <div className="space-y-3">
          {/* Team 1 */}
          {matchup.team1 && (
            <Link 
              href={`/teams/${matchup.team1.id}`}
              className={`flex items-center justify-between p-2 rounded transition-colors ${
                winner === matchup.team1 
                  ? 'bg-emerald-100 border-2 border-emerald-600' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {seeding && (
                  <span className="text-[10px] font-black text-gray-500 w-4">
                    #{seeding.team1Seed}
                  </span>
                )}
                <TeamLogo teamId={matchup.team1.id} size={24} />
                <span className="font-black text-xs uppercase">{matchup.team1.name}</span>
              </div>
              <span className="text-xs font-bold">{matchup.team1Wins}</span>
            </Link>
          )}
          
          {/* Team 2 */}
          {matchup.team2 && (
            <Link 
              href={`/teams/${matchup.team2.id}`}
              className={`flex items-center justify-between p-2 rounded transition-colors ${
                winner === matchup.team2 
                  ? 'bg-emerald-100 border-2 border-emerald-600' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {seeding && (
                  <span className="text-[10px] font-black text-gray-500 w-4">
                    #{seeding.team2Seed}
                  </span>
                )}
                <TeamLogo teamId={matchup.team2.id} size={24} />
                <span className="font-black text-xs uppercase">{matchup.team2.name}</span>
              </div>
              <span className="text-xs font-bold">{matchup.team2Wins}</span>
            </Link>
          )}
          
          {/* Games */}
          {matchup.games.length > 0 && (
            <div className="border-t pt-2">
              <div className="space-y-1">
                {matchup.games.map((game: any, index: number) => (
                  <Link
                    key={index}
                    href={`/games/${game.id}`}
                    className="flex items-center justify-between text-[10px] p-1 hover:bg-gray-50 rounded transition-colors"
                  >
                    <span className="text-gray-600">Game {index + 1}</span>
                    <div className="flex items-center gap-2">
                      <span>{game.homeScore} - {game.awayScore}</span>
                      {game.finished && <span className="text-emerald-600 font-black">Final</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          
          {/* ESPN-style Status */}
          <div className="text-[10px] text-gray-700 text-center font-medium">
            {getEspnStatus(matchup)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Header */}
      <section className="relative w-full overflow-hidden">
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/playoffs/playoff_bracket_square.webp" />
          <img 
            src="/images/playoffs/playoff mobile.png" 
            alt="Playoffs 2026 - Liga Basket Moldova"
            className="w-full h-auto object-cover"
          />
        </picture>
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-4xl md:text-6xl font-black uppercase italic mb-2">Playoffs</h1>
            <p className="text-xl md:text-2xl font-bold">Division B</p>
            <p className="text-sm md:text-base mt-2">First to 2 wins advances</p>
          </div>
        </div>
      </section>

      {/* Visual Bracket Container */}
      <section className="px-3 sm:px-6 py-8">
        <div className="max-w-7xl mx-auto overflow-x-auto">
          <div className="min-w-[800px]">
            
            {/* Visual Bracket Layout */}
            <div className="flex items-start justify-between gap-8">
              
              {/* Quarterfinals Column */}
              <div className="flex-1">
                <h2 className="text-lg font-black uppercase italic mb-4">Quarterfinals</h2>
                <div className="space-y-6">
                  {bracket.quarterfinals.map((matchup, index) => (
                    <div key={`qf-${index}`} className="relative">
                      <MatchupCard 
                        matchup={matchup} 
                        round="quarterfinals" 
                        seeding={{
                          team1Seed: index === 0 ? 1 : index === 1 ? 4 : index === 2 ? 2 : 3,
                          team2Seed: index === 0 ? 8 : index === 1 ? 5 : index === 2 ? 7 : 6
                        }}
                      />
                      {/* Bracket lines */}
                      {index < 2 && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                          <div className="w-0.5 h-6 bg-black"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Connector Lines */}
              <div className="flex items-center justify-center w-24">
                <div className="space-y-20">
                  {/* First semifinal connector */}
                  <div className="flex items-center">
                    <div className="w-8 h-0.5 bg-black"></div>
                    <div className="w-0.5 h-12 bg-black"></div>
                    <div className="w-8 h-0.5 bg-black"></div>
                  </div>
                  {/* Second semifinal connector */}
                  <div className="flex items-center">
                    <div className="w-8 h-0.5 bg-black"></div>
                    <div className="w-0.5 h-12 bg-black"></div>
                    <div className="w-8 h-0.5 bg-black"></div>
                  </div>
                </div>
              </div>

              {/* Semifinals Column */}
              <div className="flex-1">
                <h2 className="text-lg font-black uppercase italic mb-4">Semifinals</h2>
                <div className="space-y-16">
                  {bracket.semifinals.map((matchup, index) => (
                    <div key={`sf-${index}`} className="relative">
                      {matchup.team1 && matchup.team2 ? (
                        <MatchupCard matchup={matchup} round="semifinals" />
                      ) : (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                          <div className="text-gray-500 font-medium">
                            <p className="text-xs mb-1">Winner QF{index * 2 + 1}</p>
                            <p className="text-xs">vs</p>
                            <p className="text-xs mt-1">Winner QF{index * 2 + 2}</p>
                          </div>
                        </div>
                      )}
                      {/* Bracket line to finals */}
                      {index === 0 && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                          <div className="w-0.5 h-8 bg-black"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Connector Lines to Finals */}
              <div className="flex items-center justify-center w-24">
                <div className="flex items-center">
                  <div className="w-8 h-0.5 bg-black"></div>
                  <div className="w-0.5 h-20 bg-black"></div>
                  <div className="w-8 h-0.5 bg-black"></div>
                </div>
              </div>

              {/* Finals Column */}
              <div className="flex-1">
                <h2 className="text-lg font-black uppercase italic mb-4">Division B Finals</h2>
                <div className="mt-12">
                  {bracket.finals[0].team1 && bracket.finals[0].team2 ? (
                    <MatchupCard matchup={bracket.finals[0]} round="finals" />
                  ) : (
                    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <div className="text-gray-500 font-medium">
                        <p className="text-sm mb-2">Champion</p>
                        <p className="text-xs">SF Winner vs SF Winner</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-gray-100 border-2 border-black rounded-lg p-4 mt-8">
              <h3 className="font-black uppercase text-sm mb-3">How it works:</h3>
              <ul className="space-y-1 text-xs text-gray-700">
                <li>• 8 teams compete in Division B playoffs</li>
                <li>• First team to win 2 games advances to next round</li>
                <li>• Click on teams to view team pages</li>
                <li>• Click on games to view game details</li>
                <li>• ESPN-style format shows current series status</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
