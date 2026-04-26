"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import TeamLogo from "@/app/components/TeamLogo";
import GameSharePanel from "@/app/components/GameSharePanel";

type Game = { game_id: string; season: string | null; tipoff: string | null; venue: string | null; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null; };
type Team = { team_id: string; team_name: string; };
type PlayerStat = {
  player_id: string;
  team_id: string;
  is_starter: boolean | null;
  points: number | null;
  minutes: string | null;
  two_made: number | null;
  two_att: number | null;
  three_made: number | null;
  three_att: number | null;
  ft_made: number | null;
  ft_att: number | null;
  reb_off: number | null;
  reb_def: number | null;
  reb_tot: number | null;
  assists: number | null;
  turnovers: number | null;
  steals: number | null;
  blocks: number | null;
  fouls_personal: number | null;
  plus_minus: number | null;
  efficiency: number | null;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number | null;
};
type RawPlayerGameStat = {
  player_id: string;
  team_id: string;
  is_starter: boolean | null;
  points: number | null;
  minutes: string | null;
  two_made: number | null;
  two_att: number | null;
  three_made: number | null;
  three_att: number | null;
  ft_made: number | null;
  ft_att: number | null;
  reb_off: number | null;
  reb_def: number | null;
  reb_tot: number | null;
  assists: number | null;
  turnovers: number | null;
  steals: number | null;
  blocks: number | null;
  fouls_personal: number | null;
  plus_minus: number | null;
  efficiency: number | null;
  players:
    | { first_name: string | null; last_name: string | null; jersey_number: number | null; }
    | Array<{ first_name: string | null; last_name: string | null; jersey_number: number | null; }>
    | null;
};
type DataIssue = { level: "warn" | "error"; message: string; };

function fmtShot(made: number | null, att: number | null): string {
  if (made === null && att === null) return "—";
  return `${made ?? 0}/${att ?? 0}`;
}

function fmtNum(val: number | null): string {
  if (val === null) return "—";
  return val > 0 ? String(val) : "0";
}

function fmtPlusMinus(val: number | null): string {
  if (val === null) return "—";
  return val > 0 ? `+${val}` : String(val);
}

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
        .select(`
          player_id, team_id, is_starter, points,
          minutes, two_made, two_att, three_made, three_att,
          ft_made, ft_att, reb_off, reb_def, reb_tot,
          assists, turnovers, steals, blocks, fouls_personal,
          plus_minus, efficiency,
          players (first_name, last_name, jersey_number)
        `)
        .eq("game_id", gameId);

      if (cancelled) return;
      if (statsError) { setError(statsError); setLoading(false); return; }

      const normalized: PlayerStat[] = ((statsData ?? []) as unknown as RawPlayerGameStat[]).map((s) => {
        const player = Array.isArray(s.players) ? (s.players[0] ?? null) : s.players;
        return {
          player_id: s.player_id,
          team_id: s.team_id,
          is_starter: s.is_starter,
          points: s.points,
          minutes: s.minutes,
          two_made: s.two_made,
          two_att: s.two_att,
          three_made: s.three_made,
          three_att: s.three_att,
          ft_made: s.ft_made,
          ft_att: s.ft_att,
          reb_off: s.reb_off,
          reb_def: s.reb_def,
          reb_tot: s.reb_tot,
          assists: s.assists,
          turnovers: s.turnovers,
          steals: s.steals,
          blocks: s.blocks,
          fouls_personal: s.fouls_personal,
          plus_minus: s.plus_minus,
          efficiency: s.efficiency,
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

  const hasDetailedStats = useMemo(() => stats.some((s) => s.minutes != null), [stats]);

  // Calculate highlight score combining multiple stats
  const calculateHighlightScore = (player: PlayerStat): number => {
    // Use efficiency if available, otherwise calculate a composite score
    if (player.efficiency !== null) {
      return player.efficiency;
    }
    // Fallback: points + rebounds + assists + steals + blocks - turnovers
    return (player.points ?? 0) + (player.reb_tot ?? 0) + (player.assists ?? 0) + 
           (player.steals ?? 0) + (player.blocks ?? 0) - (player.turnovers ?? 0);
  };

  const topPlayers = useMemo(() => {
    if (stats.length === 0 || !game) return { home: null, away: null };

    const homeStats = stats.filter((s) => s.team_id === game.home_team_id);
    const awayStats = stats.filter((s) => s.team_id === game.away_team_id);

    const getTopPlayer = (teamStats: PlayerStat[]) => {
      if (teamStats.length === 0) return null;
      const best = [...teamStats].sort((a, b) => calculateHighlightScore(b) - calculateHighlightScore(a))[0];
      if (!best || calculateHighlightScore(best) <= 0) return null;
      return {
        name: `${best.first_name ?? ""} ${best.last_name ?? ""}`.trim(),
        teamName: teams[best.team_id]?.team_name ?? "",
        points: best.points ?? 0,
        rebounds: best.reb_tot ?? 0,
        assists: best.assists ?? 0,
        efficiency: best.efficiency ?? calculateHighlightScore(best),
      };
    };

    return {
      home: getTopPlayer(homeStats),
      away: getTopPlayer(awayStats),
    };
  }, [stats, teams, game]);

  if (loading) return <main className="p-8 text-center font-black uppercase italic text-gray-500">Loading Game...</main>;
  if (error || !game) return <main className="p-8 text-center text-red-500 font-bold uppercase">Game not found</main>;

  const homeTeam = teams[game.home_team_id];
  const awayTeam = teams[game.away_team_id];
  const homeStats = stats.filter((s) => s.team_id === game.home_team_id);
  const awayStats = stats.filter((s) => s.team_id === game.away_team_id);

  const dateLabel = game.tipoff
    ? new Date(game.tipoff).toLocaleDateString([], {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      })
    : "Date TBD";

  const hasFinalScore = game.home_score !== null && game.away_score !== null;
  const homeWins = hasFinalScore && game.home_score! > game.away_score!;
  const awayWins = hasFinalScore && game.away_score! > game.home_score!;

  function sortedRows(rows: PlayerStat[]): PlayerStat[] {
    if (hasDetailedStats) {
      // Starters first (by jersey number), then bench (by jersey number)
      const starters = rows.filter((r) => r.is_starter).sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));
      const bench = rows.filter((r) => !r.is_starter).sort((a, b) => (a.jersey_number ?? 99) - (b.jersey_number ?? 99));
      return [...starters, ...bench];
    }
    return [...rows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  }

  function renderSimpleTable(rows: PlayerStat[]) {
    return (
      <div className="bg-white border-4 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] mt-3" style={{ color: "#111" }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black text-white">
              <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-orange-500 w-12">#</th>
              <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-orange-500">Player</th>
              <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-orange-500 text-right">PTS</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-gray-100">
            {sortedRows(rows).map((p) => (
              <tr key={p.player_id} className="hover:bg-orange-50 transition-colors group">
                <td className="py-3 px-4 text-xs font-black italic group-hover:text-black" style={{ color: "#111", opacity: 1 }}>{p.jersey_number ?? "-"}</td>
                <td className="py-3 px-4">
                  <Link
                    href={`/players/${p.player_id}`}
                    className="text-sm font-black uppercase tracking-tighter group-hover:text-orange-600 block"
                    style={{ color: "#111", opacity: 1 }}
                  >
                    {p.first_name} {p.last_name}
                  </Link>
                </td>
                <td className="py-3 px-4 text-right text-base font-black tabular-nums italic" style={{ color: "#111", opacity: 1 }}>
                  {p.points ?? 0}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="p-10 text-xs text-center font-black uppercase italic tracking-widest" style={{ color: "#111" }}>No Stats Recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderDetailedTable(rows: PlayerStat[]) {
    const sorted = sortedRows(rows);
    const thCls = "py-3 px-2.5 text-[9px] font-black uppercase tracking-widest text-orange-500 text-right whitespace-nowrap";
    const thLeftCls = "py-3 px-3 text-[9px] font-black uppercase tracking-widest text-orange-500 text-left whitespace-nowrap";

    // Divider index: first bench player
    const firstBenchIdx = sorted.findIndex((r) => !r.is_starter);

    return (
      <div className="bg-white border-4 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] mt-3" style={{ color: "#111" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: "700px" }}>
            <thead>
              <tr className="bg-black text-white">
                <th className={`${thLeftCls} w-8`}>#</th>
                <th className={`${thLeftCls} min-w-[130px]`}>Player</th>
                <th className={thCls}>MIN</th>
                <th className={thCls}>2FG</th>
                <th className={thCls}>3FG</th>
                <th className={thCls}>FT</th>
                <th className={thCls}>REB</th>
                <th className={thCls}>AST</th>
                <th className={thCls}>TO</th>
                <th className={thCls}>STL</th>
                <th className={thCls}>BLK</th>
                <th className={thCls}>PF</th>
                <th className={thCls}>+/-</th>
                <th className={thCls}>EFF</th>
                <th className={`${thCls} text-white`}>PTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((p, idx) => {
                const isBenchDivider = idx === firstBenchIdx && firstBenchIdx > 0;
                return (
                  <tr
                    key={p.player_id}
                    className={`hover:bg-orange-50 transition-colors group ${isBenchDivider ? "border-t-2 border-gray-300" : ""}`}
                  >
                    <td className="py-2.5 px-3 text-xs font-black italic group-hover:text-black" style={{ color: "#111", opacity: 1 }}>{p.jersey_number ?? "-"}</td>
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/players/${p.player_id}`}
                        className="text-xs font-black uppercase tracking-tighter group-hover:text-orange-600 block"
                        style={{ color: "#111", opacity: 1 }}
                      >
                        {p.first_name} {p.last_name}
                      </Link>
                      {p.is_starter && (
                        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "#4b5563", opacity: 1 }}>starter</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-xs tabular-nums text-black">{p.minutes ?? "—"}</td>
                    <td className="py-2.5 px-2.5 text-right text-xs tabular-nums text-black">{fmtShot(p.two_made, p.two_att)}</td>
                    <td className="py-2.5 px-2.5 text-right text-xs tabular-nums text-black">{fmtShot(p.three_made, p.three_att)}</td>
                    <td className="py-2.5 px-2.5 text-right text-xs tabular-nums text-black">{fmtShot(p.ft_made, p.ft_att)}</td>
                    <td className="py-2.5 px-2.5 text-right text-xs font-semibold tabular-nums text-black">{fmtNum(p.reb_tot)}</td>
                    <td className="py-2.5 px-2.5 text-right text-xs font-semibold tabular-nums text-black">{fmtNum(p.assists)}</td>
                    <td className="py-2.5 px-2.5 text-right text-xs tabular-nums text-black">{fmtNum(p.turnovers)}</td>
                    <td className="py-2.5 px-2.5 text-right text-xs tabular-nums text-black">{fmtNum(p.steals)}</td>
                    <td className="py-2.5 px-2.5 text-right text-xs tabular-nums text-black">{fmtNum(p.blocks)}</td>
                    <td className="py-2.5 px-2.5 text-right text-xs tabular-nums text-black">{fmtNum(p.fouls_personal)}</td>
                    <td className={`py-2.5 px-2.5 text-right text-xs font-semibold tabular-nums ${(p.plus_minus ?? 0) > 0 ? "text-green-600" : (p.plus_minus ?? 0) < 0 ? "text-red-600" : "text-gray-700"}`}>
                      {fmtPlusMinus(p.plus_minus)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-xs tabular-nums text-black">{fmtNum(p.efficiency)}</td>
                    <td className="py-2.5 px-2.5 text-right text-base font-black text-black tabular-nums italic">{p.points ?? 0}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={15} className="p-10 text-xs text-center text-black font-black uppercase italic tracking-widest">No Stats Recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

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

          {/* Header row */}
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

        {/* ── Top Players strip ── */}
        {(topPlayers.home || topPlayers.away) && (
          <div className="relative z-10 mx-6 md:mx-10 mt-5 space-y-3">
            {topPlayers.home && (
              <div className="rounded-2xl flex items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(135deg, rgba(255,140,0,0.1) 0%, rgba(255,140,0,0.04) 100%)", border: "1px solid rgba(255,140,0,0.22)" }}>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <span className="text-[8px] font-bold uppercase tracking-[2.5px]" style={{ color: "#FF8C00", opacity: 0.8 }}>★ {homeTeam?.team_name ?? "Home"} Top Player</span>
                  <span className="font-black leading-none break-words whitespace-normal" style={{ display: "block", fontFamily: "'Bebas Neue', Impact, serif", fontSize: "24px", color: "#fff", letterSpacing: "1px" }}>{topPlayers.home.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-center">
                    <span className="font-black leading-none block" style={{ fontFamily: "'Bebas Neue', Impact, serif", fontSize: "32px", color: "#FF8C00", textShadow: "0 0 24px rgba(255,130,0,0.4)" }}>{topPlayers.home.points}</span>
                    <span className="text-[7px] font-bold uppercase tracking-[1px]" style={{ color: "rgba(255,140,0,0.5)" }}>PTS</span>
                  </div>
                  {topPlayers.home.rebounds > 0 && (
                    <div className="text-center">
                      <span className="font-black leading-none block" style={{ fontFamily: "'Bebas Neue', Impact, serif", fontSize: "24px", color: "#fff" }}>{topPlayers.home.rebounds}</span>
                      <span className="text-[7px] font-bold uppercase tracking-[1px]" style={{ color: "rgba(255,255,255,0.5)" }}>REB</span>
                    </div>
                  )}
                  {topPlayers.home.assists > 0 && (
                    <div className="text-center">
                      <span className="font-black leading-none block" style={{ fontFamily: "'Bebas Neue', Impact, serif", fontSize: "24px", color: "#fff" }}>{topPlayers.home.assists}</span>
                      <span className="text-[7px] font-bold uppercase tracking-[1px]" style={{ color: "rgba(255,255,255,0.5)" }}>AST</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {topPlayers.away && (
              <div className="rounded-2xl flex items-center justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(135deg, rgba(255,140,0,0.1) 0%, rgba(255,140,0,0.04) 100%)", border: "1px solid rgba(255,140,0,0.22)" }}>
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <span className="text-[8px] font-bold uppercase tracking-[2.5px]" style={{ color: "#FF8C00", opacity: 0.8 }}>★ {awayTeam?.team_name ?? "Away"} Top Player</span>
                  <span className="font-black leading-none break-words whitespace-normal" style={{ display: "block", fontFamily: "'Bebas Neue', Impact, serif", fontSize: "24px", color: "#fff", letterSpacing: "1px" }}>{topPlayers.away.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-center">
                    <span className="font-black leading-none block" style={{ fontFamily: "'Bebas Neue', Impact, serif", fontSize: "32px", color: "#FF8C00", textShadow: "0 0 24px rgba(255,130,0,0.4)" }}>{topPlayers.away.points}</span>
                    <span className="text-[7px] font-bold uppercase tracking-[1px]" style={{ color: "rgba(255,140,0,0.5)" }}>PTS</span>
                  </div>
                  {topPlayers.away.rebounds > 0 && (
                    <div className="text-center">
                      <span className="font-black leading-none block" style={{ fontFamily: "'Bebas Neue', Impact, serif", fontSize: "24px", color: "#fff" }}>{topPlayers.away.rebounds}</span>
                      <span className="text-[7px] font-bold uppercase tracking-[1px]" style={{ color: "rgba(255,255,255,0.5)" }}>REB</span>
                    </div>
                  )}
                  {topPlayers.away.assists > 0 && (
                    <div className="text-center">
                      <span className="font-black leading-none block" style={{ fontFamily: "'Bebas Neue', Impact, serif", fontSize: "24px", color: "#fff" }}>{topPlayers.away.assists}</span>
                      <span className="text-[7px] font-bold uppercase tracking-[1px]" style={{ color: "rgba(255,255,255,0.5)" }}>AST</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
              homeTeam={{ name: homeTeam?.team_name ?? "Home Team", logoUrl: `/images/teams/${game.home_team_id.toLowerCase()}.webp` }}
              awayTeam={{ name: awayTeam?.team_name ?? "Away Team", logoUrl: `/images/teams/${game.away_team_id.toLowerCase()}.webp` }}
              homeScore={game.home_score!}
              awayScore={game.away_score!}
              venue={game.venue ?? "Local Arena"}
              date={dateLabel}
              season={game.season ?? "2025-2026"}
              topPlayers={topPlayers}
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

      {/* BOX SCORES */}
      <div className={`mt-12 ${hasDetailedStats ? "space-y-12" : "grid grid-cols-1 lg:grid-cols-2 gap-12"}`}>
        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-black">
              {homeTeam?.team_name ?? "Home"} Box Score
            </h2>
            <div className="h-1 flex-1 bg-black"></div>
          </div>
          {hasDetailedStats ? renderDetailedTable(homeStats) : renderSimpleTable(homeStats)}
        </section>

        <section>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-xs font-black uppercase tracking-[0.4em] text-black">
              {awayTeam?.team_name ?? "Away"} Box Score
            </h2>
            <div className="h-1 flex-1 bg-black"></div>
          </div>
          {hasDetailedStats ? renderDetailedTable(awayStats) : renderSimpleTable(awayStats)}
        </section>
      </div>
    </main>
  );
}
