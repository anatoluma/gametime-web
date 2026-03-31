"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import TeamLogo from "@/app/components/TeamLogo";
import GameSharePanel from "@/app/components/GameSharePanel";

// ... Types remain exactly the same ...
type Game = { game_id: string; season: string | null; tipoff: string | null; venue: string | null; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null; };
type Team = { team_id: string; team_name: string; };
type PlayerStat = { player_id: string; team_id: string; points: number | null; first_name: string | null; last_name: string | null; jersey_number: number | null; };
type RawPlayerGameStat = {
  player_id: string;
  team_id: string;
  points: number | null;
  players:
    | {
        first_name: string | null;
        last_name: string | null;
        jersey_number: number | null;
      }
    | Array<{
        first_name: string | null;
        last_name: string | null;
        jersey_number: number | null;
      }>
    | null;
};
type DataIssue = { level: "warn" | "error"; message: string; };

export default function GamePage() {
  const params = useParams<{ game_id?: string | string[] }>();
  const gameId = useMemo(() => {
    const raw = params?.game_id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [issues, setIssues] = useState<DataIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!gameId) return;
      setLoading(true);
      setError(null);
      setIssues([]);

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("game_id", gameId)
        .maybeSingle();

      if (cancelled) return;
      if (gameError || !gameData) {
        setError(gameError ?? { message: "Game not found" });
        setLoading(false);
        return;
      }
      setGame(gameData as Game);

      const { data: teamsData } = await supabase.from("teams").select("team_id, team_name");

      const teamMap: Record<string, Team> = {};
      (teamsData ?? []).forEach((t: Team) => { teamMap[t.team_id] = t; });
      setTeams(teamMap);

      const { data: statsData, error: statsError } = await supabase
        .from("player_game_stats")
        .select(`player_id, team_id, points, players (first_name, last_name, jersey_number)`)
        .eq("game_id", gameId);

      if (cancelled) return;
      if (statsError) { setError(statsError); setLoading(false); return; }

      const normalized: PlayerStat[] = ((statsData ?? []) as unknown as RawPlayerGameStat[]).map((s) => {
        const player = Array.isArray(s.players) ? (s.players[0] ?? null) : s.players;

        return {
          player_id: s.player_id,
          team_id: s.team_id,
          points: s.points,
          first_name: player?.first_name ?? null,
          last_name: player?.last_name ?? null,
          jersey_number: player?.jersey_number ?? null,
        };
      });

      const newIssues: DataIssue[] = [];
      const homeId = (gameData as Game).home_team_id;
      const awayId = (gameData as Game).away_team_id;

      const badTeamRows = normalized.filter((r) => r.team_id !== homeId && r.team_id !== awayId);
      if (badTeamRows.length > 0) newIssues.push({ level: "error", message: `Incorrect team_id found in stats.` });

      const sumPts = (teamId: string) => normalized.filter((r) => r.team_id === teamId).reduce((s, r) => s + (r.points ?? 0), 0);
      const homeBox = sumPts(homeId);
      const awayBox = sumPts(awayId);
      
      if (gameData.home_score != null && gameData.away_score != null) {
        if (homeBox !== gameData.home_score) newIssues.push({ level: "warn", message: `Home mismatch (Box: ${homeBox} vs Final: ${gameData.home_score})` });
        if (awayBox !== gameData.away_score) newIssues.push({ level: "warn", message: `Away mismatch (Box: ${awayBox} vs Final: ${gameData.away_score})` });
      }

      setIssues(newIssues);
      setStats(normalized);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [gameId]);

  const topScorer = useMemo(() => {
    if (stats.length === 0) return null;
    const best = [...stats].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
    if (!best || (best.points ?? 0) === 0) return null;
    return {
      name: `${best.first_name ?? ""} ${best.last_name ?? ""}`.trim(),
      points: best.points ?? 0,
      teamName: teams[best.team_id]?.team_name ?? "",
    };
  }, [stats, teams]);

  if (loading) return <main className="p-8 text-center font-black uppercase italic text-gray-500">Loading Game...</main>;
  if (error || !game) return <main className="p-8 text-center text-red-500 font-bold uppercase">Game not found</main>;

  const homeTeam = teams[game.home_team_id];
  const awayTeam = teams[game.away_team_id];
  const homeStats = stats.filter((s) => s.team_id === game.home_team_id);
  const awayStats = stats.filter((s) => s.team_id === game.away_team_id);

  const dateLabel = game.tipoff
    ? new Date(game.tipoff).toLocaleDateString([], {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Date TBD";

  const hasFinalScore = game.home_score !== null && game.away_score !== null;
  const homeWins = hasFinalScore && game.home_score! > game.away_score!;
  const awayWins = hasFinalScore && game.away_score! > game.home_score!;

  // UPDATED: High Contrast Table
  const renderTable = (rows: PlayerStat[]) => (
    <div className="bg-white border-4 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] mt-3">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-black text-white">
            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-orange-500 w-12">#</th>
            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-orange-500">Player</th>
            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-orange-500 text-right">PTS</th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-gray-100">
          {rows.sort((a,b) => (b.points ?? 0) - (a.points ?? 0)).map((p) => (
            <tr key={p.player_id} className="hover:bg-orange-50 transition-colors group">
              <td className="py-3 px-4 text-xs font-black text-gray-400 italic group-hover:text-black">{p.jersey_number ?? "-"}</td>
              <td className="py-3 px-4">
                <Link href={`/players/${p.player_id}`} className="text-sm font-black uppercase tracking-tighter text-black group-hover:text-orange-600 block">
                  {p.first_name} {p.last_name}
                </Link>
              </td>
              <td className="py-3 px-4 text-right text-base font-black text-black tabular-nums italic">
                {p.points ?? 0}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="p-10 text-xs text-center text-gray-400 font-black uppercase italic tracking-widest">No Stats Recorded</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto bg-white min-h-screen border-x border-gray-100">
      {/* SCOREBOARD HERO */}
      <div
        className="relative overflow-hidden rounded-3xl text-white shadow-2xl"
        style={{ background: "#0d0d14" }}
      >
        {/* ── Background decorations ── */}
        <div className="pointer-events-none absolute" style={{ width: "600px", height: "600px", borderRadius: "50%", border: "1px solid rgba(255,140,0,0.05)", top: "-240px", left: "50%", transform: "translateX(-50%)" }} />
        <div className="pointer-events-none absolute" style={{ width: "440px", height: "440px", borderRadius: "50%", border: "1px solid rgba(255,140,0,0.05)", top: "-180px", left: "50%", transform: "translateX(-50%)" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: "200px", background: "radial-gradient(ellipse at top center, rgba(255,130,0,0.08), transparent)" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20" style={{ height: "3px", background: "linear-gradient(90deg, transparent, #FF8C00 25%, #FFB800 50%, #FF8C00 75%, transparent)", animation: "accentPulse 2.5s ease-in-out infinite" }} />

        {/* ── Content ── */}
        <div className="relative z-10 px-6 md:px-10 pt-6 pb-0">

          {/* Header row: branding only (pill moved to score center) */}
          <div className="flex items-start justify-end mb-4">
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "1px" }}>
                <span style={{ color: "rgba(255,255,255,0.85)" }}>liga</span>
                <span style={{ color: "#FF8C00" }}>basket</span>
                <span style={{ color: "rgba(255,255,255,0.85)" }}>.md</span>
              </div>
              <div style={{ fontSize: "8px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>Basketball League</div>
            </div>
          </div>

          {/* ── MOBILE layout ── */}
          <div className="md:hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">

              {/* Home team */}
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <div style={{ width: "64px", height: "64px", borderRadius: "50%", border: homeWins ? "2px solid rgba(255,140,0,0.45)" : "2px solid rgba(255,255,255,0.08)", background: homeWins ? "rgba(255,140,0,0.06)" : "rgba(255,255,255,0.04)", boxShadow: homeWins ? "0 0 20px rgba(255,130,0,0.15)" : "none", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <TeamLogo teamId={game.home_team_id} teamName={homeTeam?.team_name ?? "Home Team"} size={56} className="h-14 w-14 object-contain" />
                  </div>
                  {homeWins && (
                    <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "18px", height: "18px", borderRadius: "50%", background: "#FF8C00", border: "2px solid #0d0d14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: 900, color: "#000" }}>✓</div>
                  )}
                </div>
                <Link href={`/teams/${game.home_team_id}`} className="mt-2 min-h-[36px] text-sm font-black uppercase tracking-tight leading-tight break-words transition-colors" style={{ color: homeWins ? "#FF8C00" : "rgba(255,255,255,0.85)" }}>
                  {homeTeam?.team_name ?? "Home Team"}
                </Link>
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] mt-1" style={{ color: homeWins ? "rgba(255,140,0,0.6)" : "rgba(255,255,255,0.22)" }}>
                  {homeWins ? "HOME · WINNER" : "HOME"}
                </p>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center pt-1">
                <div className="flex items-end">
                  <span className="text-5xl font-black tabular-nums leading-none" style={{ fontFamily: "'Bebas Neue', Impact, serif", color: hasFinalScore ? (homeWins ? "#FF8C00" : "rgba(255,255,255,0.3)") : "white", textShadow: homeWins ? "0 0 40px rgba(255,130,0,0.35)" : "none" }}>{game.home_score ?? "-"}</span>
                  <span className="text-2xl font-black leading-none pb-1 px-1" style={{ fontFamily: "'Bebas Neue', Impact, serif", color: "rgba(255,255,255,0.13)" }}>:</span>
                  <span className="text-5xl font-black tabular-nums leading-none" style={{ fontFamily: "'Bebas Neue', Impact, serif", color: hasFinalScore ? (awayWins ? "#FF8C00" : "rgba(255,255,255,0.3)") : "white", textShadow: awayWins ? "0 0 40px rgba(255,130,0,0.35)" : "none" }}>{game.away_score ?? "-"}</span>
                </div>
                <div className="mt-3" style={{ background: hasFinalScore ? "rgba(255,140,0,0.12)" : "rgba(255,255,255,0.07)", border: hasFinalScore ? "1px solid rgba(255,140,0,0.3)" : "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "4px 10px", fontSize: "8px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: hasFinalScore ? "#FF8C00" : "rgba(255,255,255,0.4)" }}>
                  {hasFinalScore ? "⚡ Final" : "Scheduled"}
                </div>
              </div>

              {/* Away team */}
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <div style={{ width: "64px", height: "64px", borderRadius: "50%", border: awayWins ? "2px solid rgba(255,140,0,0.45)" : "2px solid rgba(255,255,255,0.08)", background: awayWins ? "rgba(255,140,0,0.06)" : "rgba(255,255,255,0.04)", boxShadow: awayWins ? "0 0 20px rgba(255,130,0,0.15)" : "none", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <TeamLogo teamId={game.away_team_id} teamName={awayTeam?.team_name ?? "Away Team"} size={56} className="h-14 w-14 object-contain" />
                  </div>
                  {awayWins && (
                    <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "18px", height: "18px", borderRadius: "50%", background: "#FF8C00", border: "2px solid #0d0d14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: 900, color: "#000" }}>✓</div>
                  )}
                </div>
                <Link href={`/teams/${game.away_team_id}`} className="mt-2 min-h-[36px] text-sm font-black uppercase tracking-tight leading-tight break-words transition-colors" style={{ color: awayWins ? "#FF8C00" : "rgba(255,255,255,0.85)" }}>
                  {awayTeam?.team_name ?? "Away Team"}
                </Link>
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] mt-1" style={{ color: awayWins ? "rgba(255,140,0,0.6)" : "rgba(255,255,255,0.22)" }}>
                  {awayWins ? "AWAY · WINNER" : "AWAY"}
                </p>
              </div>

            </div>
          </div>

          {/* ── DESKTOP layout ── */}
          <div className="hidden md:flex items-center justify-between gap-8">

            {/* Home team — left-aligned */}
            <div className="flex-1 flex flex-col items-start">
              <div className="flex items-center gap-5">
                <div className="relative flex-shrink-0">
                  <div style={{ width: "80px", height: "80px", borderRadius: "50%", border: homeWins ? "2px solid rgba(255,140,0,0.45)" : "2px solid rgba(255,255,255,0.08)", background: homeWins ? "rgba(255,140,0,0.06)" : "rgba(255,255,255,0.04)", boxShadow: homeWins ? "0 0 24px rgba(255,130,0,0.18)" : "none", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <TeamLogo teamId={game.home_team_id} teamName={homeTeam?.team_name ?? "Home Team"} size={72} className="h-[72px] w-[72px] object-contain" />
                  </div>
                  {homeWins && (
                    <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "20px", height: "20px", borderRadius: "50%", background: "#FF8C00", border: "2px solid #0d0d14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 900, color: "#000" }}>✓</div>
                  )}
                </div>
                <div>
                  <Link href={`/teams/${game.home_team_id}`} className="block font-black uppercase tracking-tighter leading-[0.9] break-words transition-colors text-2xl md:text-3xl xl:text-4xl" style={{ color: homeWins ? "#FF8C00" : "rgba(255,255,255,0.9)" }}>
                    {homeTeam?.team_name ?? "Home Team"}
                  </Link>
                  <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: homeWins ? "rgba(255,140,0,0.6)" : "rgba(255,255,255,0.22)" }}>
                    {homeWins ? "HOME · WINNER" : "HOME"}
                  </p>
                </div>
              </div>
            </div>

            {/* Score — center */}
            <div className="text-center flex flex-col items-center flex-shrink-0">
              <div className="flex items-end">
                <span className="font-black tabular-nums leading-none text-7xl md:text-8xl" style={{ fontFamily: "'Bebas Neue', Impact, serif", color: hasFinalScore ? (homeWins ? "#FF8C00" : "rgba(255,255,255,0.3)") : "white", textShadow: homeWins ? "0 0 50px rgba(255,130,0,0.4)" : "none" }}>{game.home_score ?? "-"}</span>
                <span className="font-black leading-none pb-2 px-2 text-4xl" style={{ fontFamily: "'Bebas Neue', Impact, serif", color: "rgba(255,255,255,0.12)" }}>:</span>
                <span className="font-black tabular-nums leading-none text-7xl md:text-8xl" style={{ fontFamily: "'Bebas Neue', Impact, serif", color: hasFinalScore ? (awayWins ? "#FF8C00" : "rgba(255,255,255,0.3)") : "white", textShadow: awayWins ? "0 0 50px rgba(255,130,0,0.4)" : "none" }}>{game.away_score ?? "-"}</span>
              </div>
              <div className="mt-4" style={{ background: hasFinalScore ? "rgba(255,140,0,0.12)" : "rgba(255,255,255,0.07)", border: hasFinalScore ? "1px solid rgba(255,140,0,0.3)" : "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "5px 14px", fontSize: "9px", fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: hasFinalScore ? "#FF8C00" : "rgba(255,255,255,0.4)" }}>
                {hasFinalScore ? "⚡ Final Result" : "Scheduled"}
              </div>
            </div>

            {/* Away team — right-aligned */}
            <div className="flex-1 flex flex-col items-end">
              <div className="flex items-center gap-5 flex-row-reverse">
                <div className="relative flex-shrink-0">
                  <div style={{ width: "80px", height: "80px", borderRadius: "50%", border: awayWins ? "2px solid rgba(255,140,0,0.45)" : "2px solid rgba(255,255,255,0.08)", background: awayWins ? "rgba(255,140,0,0.06)" : "rgba(255,255,255,0.04)", boxShadow: awayWins ? "0 0 24px rgba(255,130,0,0.18)" : "none", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <TeamLogo teamId={game.away_team_id} teamName={awayTeam?.team_name ?? "Away Team"} size={72} className="h-[72px] w-[72px] object-contain" />
                  </div>
                  {awayWins && (
                    <div style={{ position: "absolute", top: "-3px", right: "-3px", width: "20px", height: "20px", borderRadius: "50%", background: "#FF8C00", border: "2px solid #0d0d14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 900, color: "#000" }}>✓</div>
                  )}
                </div>
                <div className="text-right">
                  <Link href={`/teams/${game.away_team_id}`} className="block font-black uppercase tracking-tighter leading-[0.9] break-words transition-colors text-2xl md:text-3xl xl:text-4xl" style={{ color: awayWins ? "#FF8C00" : "rgba(255,255,255,0.9)" }}>
                    {awayTeam?.team_name ?? "Away Team"}
                  </Link>
                  <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: awayWins ? "rgba(255,140,0,0.6)" : "rgba(255,255,255,0.22)" }}>
                    {awayWins ? "AWAY · WINNER" : "AWAY"}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Meta strip ── */}
        <div className="relative z-10 mt-5 px-6 md:px-10 py-4 pr-16 md:pr-20 flex flex-wrap gap-x-8 gap-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="flex items-center gap-2">
            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full" style={{ background: "#FF8C00", opacity: 0.5 }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.6)" }}>{dateLabel}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full" style={{ background: "#FF8C00", opacity: 0.5 }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>{game.venue ?? "Local Arena"}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full" style={{ background: "#FF8C00", opacity: 0.5 }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>Season {game.season ?? "2025-2026"}</span>
          </span>
        </div>

        {/* ── Share button ── */}
        {hasFinalScore && (
          <div className="absolute bottom-4 right-4 z-20 md:bottom-5 md:right-6">
            <GameSharePanel
              gameId={game.game_id}
              homeTeam={{
                name: homeTeam?.team_name ?? "Home Team",
                logoUrl: `/images/teams/${game.home_team_id.toLowerCase()}.webp`,
              }}
              awayTeam={{
                name: awayTeam?.team_name ?? "Away Team",
                logoUrl: `/images/teams/${game.away_team_id.toLowerCase()}.webp`,
              }}
              homeScore={game.home_score!}
              awayScore={game.away_score!}
              venue={game.venue ?? "Local Arena"}
              date={dateLabel}
              season={game.season ?? "2025-2026"}
              topScorer={topScorer}
            />
          </div>
        )}
      </div>

      {/* ISSUES ALERT BOX */}
      {issues.length > 0 && (
        <div className="mt-8 bg-red-50 border-l-8 border-red-600 p-6 shadow-sm">
            <h3 className="text-[12px] font-black uppercase text-red-600 tracking-widest mb-2">Data Integrity Alert</h3>
            <ul className="space-y-1">
              {issues.map((i, idx) => (
                <li key={idx} className="text-xs font-black text-gray-900">• {i.message}</li>
              ))}
            </ul>
        </div>
      )}

      {/* BOX SCORES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-black">Home Box Score</h2>
            <div className="h-1 flex-1 bg-black"></div>
          </div>
          {renderTable(homeStats)}
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-black">Away Box Score</h2>
            <div className="h-1 flex-1 bg-black"></div>
          </div>
          {renderTable(awayStats)}
        </section>
      </div>
    </main>
  );
}
