"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PlayerAvatar from "@/app/components/PlayerAvatar";
import { useT } from "@/app/components/LanguageProvider";
import SectionHeading from "@/app/components/home/SectionHeading";

type Player = {
  player_id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
};

type Team = {
  team_id: string;
  team_name: string;
};

type StatRow = {
  game_id: string;
  points: number | null;
};

type GameRow = {
  game_id: string;
  tipoff: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

export default function PlayerPage() {
  const params = useParams();
  const { t } = useT();

  const playerId = useMemo(() => {
    const raw = (params as any)?.player_id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [gamesById, setGamesById] = useState<Record<string, GameRow>>({});
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!playerId) return;
      setLoading(true);
      setError(null);

      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("player_id, team_id, first_name, last_name, jersey_number")
        .eq("player_id", playerId)
        .maybeSingle();

      if (cancelled) return;
      if (playerError || !playerData) {
        setError(playerError ?? { message: "Player not found" });
        setLoading(false);
        return;
      }

      setPlayer(playerData as Player);

      const { data: teamData } = await supabase
        .from("teams")
        .select("team_id, team_name")
        .eq("team_id", (playerData as Player).team_id)
        .maybeSingle();

      if (!cancelled) setTeam((teamData as Team) ?? null);

      const { data: statsData, error: statsError } = await supabase
        .from("player_game_stats")
        .select("game_id, points")
        .eq("player_id", playerId);

      if (cancelled) return;
      if (statsError) {
        setError(statsError);
        setLoading(false);
        return;
      }

      const statRows = (statsData ?? []) as StatRow[];
      setStats(statRows);

      const gameIds = Array.from(new Set(statRows.map((s) => s.game_id)));
      if (gameIds.length === 0) {
        setGamesById({});
        setLoading(false);
        return;
      }

      const { data: gamesData, error: gamesError } = await supabase
        .from("games")
        .select("game_id, tipoff, home_team_id, away_team_id, home_score, away_score")
        .in("game_id", gameIds);

      if (cancelled) return;
      if (gamesError) {
        setError(gamesError);
        setLoading(false);
        return;
      }

      const map: Record<string, GameRow> = {};
      (gamesData ?? []).forEach((g: any) => (map[g.game_id] = g));
      setGamesById(map);

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [playerId]);

  if (!playerId) return <main className="p-8"><h1 className="text-2xl font-semibold uppercase">{t("player_bad_route")}</h1></main>;
  if (loading) return <main className="p-8"><h1 className="text-2xl font-semibold uppercase animate-pulse" style={{ color: "var(--muted)" }}>{t("player_loading")}</h1></main>;
  if (error || !player) return (
    <main className="p-8" style={{ color: "var(--text)" }}>
      <h1 className="text-2xl font-semibold uppercase">{t("player_error")}</h1>
      <pre className="mt-4 text-sm bg-red-50 p-4 rounded text-red-600 border border-red-100">{JSON.stringify(error, null, 2)}</pre>
    </main>
  );

  const totalPoints = stats.reduce((sum, s) => sum + (s.points ?? 0), 0);
  const gamesPlayed = stats.length;
  const ppg = gamesPlayed > 0 ? (totalPoints / gamesPlayed).toFixed(1) : "0.0";

  const rows = [...stats].sort((a, b) => {
    const da = gamesById[a.game_id]?.tipoff ? new Date(gamesById[a.game_id].tipoff!).getTime() : -Infinity;
    const db = gamesById[b.game_id]?.tipoff ? new Date(gamesById[b.game_id].tipoff!).getTime() : -Infinity;
    return db - da;
  });

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6" style={{ background: "var(--navy-950)", color: "var(--text)" }}>
      <div className="mx-auto max-w-5xl">
      {/* Header Section */}
      <div className="mb-8 flex flex-col justify-between gap-6 border-b pb-6 md:flex-row md:items-end" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-end gap-4">
          <PlayerAvatar
            playerId={player.player_id}
            playerName={`${player.first_name} ${player.last_name}`}
            width={96}
            height={120}
            className="h-24 w-20 shrink-0 rounded-[var(--radius)] object-cover md:h-[120px] md:w-24"
          />

          <div>
          <h1 className="text-4xl uppercase tracking-tight md:text-5xl" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
            {player.first_name} {player.last_name}
          </h1>
          <div className="flex items-center gap-3 mt-4 text-lg">
            <span className="px-3 py-1 text-sm uppercase" style={{ background: "var(--orange)", color: "#1f1309", borderRadius: "var(--radius)", fontFamily: "var(--font-display)", fontWeight: 700 }}>#{player.jersey_number ?? "?"}</span>
            <Link href={`/teams/${player.team_id}`} className="font-semibold uppercase tracking-tight underline decoration-[var(--orange)] decoration-2 underline-offset-4 transition-colors hover:text-[var(--orange)]" style={{ color: "var(--muted)" }}>
              {team?.team_name ?? player.team_id}
            </Link>
          </div>
          </div>
        </div>

        {/* Quick Stats Cards - Fixed Visibility */}
        <div className="flex gap-3">
          <div className="min-w-[85px] flex-1 border p-4 text-center md:flex-none" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{t("player_stat_gp")}</div>
            <div className="text-2xl leading-none" style={{ color: "var(--text)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{gamesPlayed}</div>
          </div>
          <div className="min-w-[85px] flex-1 border p-4 text-center md:flex-none" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{t("player_stat_total_pts")}</div>
            <div className="text-2xl leading-none" style={{ color: "var(--text)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{totalPoints}</div>
          </div>
          <div className="min-w-[85px] flex-1 border p-4 text-center md:flex-none" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{t("player_stat_ppg")}</div>
            <div className="text-2xl leading-none" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{ppg}</div>
          </div>
        </div>
      </div>

      <SectionHeading title={t("player_game_log")} href="/games" linkLabel={t("home_cta_results")} headingClassName="text-lg" />

      {/* GAME LOG LIST */}
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
            else { resultChar = "T"; resultColor = "text-gray-500"; }
          }

          const dateObj = g.tipoff ? new Date(g.tipoff) : null;
          const formattedDate = dateObj ? dateObj.toLocaleDateString('ro-MD', { month: 'short', day: 'numeric' }) : "TBD";

          return (
            /* CLICKABLE WRAPPER: Now links to the specific Game Page */
            <Link 
              key={s.game_id} 
              href={`/games/${s.game_id}`} 
              className="group flex items-center justify-between border p-4 transition-colors hover:border-[var(--orange)]"
              style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}
            >
              <div className="flex items-center gap-4">
                {/* Date & Result */}
                <div className="text-center min-w-[45px]">
                  <div className="mb-1 text-[10px] font-semibold uppercase leading-none" style={{ color: "var(--muted)" }}>{formattedDate}</div>
                  <div className={`text-xl font-black ${resultColor} leading-none italic`}>{resultChar}</div>
                </div>
                
                {/* Opponent & Match Score */}
                <div className="border-l pl-4" style={{ borderColor: "var(--line)" }}>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-tight" style={{ color: "var(--muted)" }}>
                    {isHome ? "vs" : "@"} <span style={{ color: "var(--text)" }} className="transition-colors group-hover:text-[var(--orange)]">{opponent}</span>
                  </div>
                  <div className="text-xs tabular-nums" style={{ color: "var(--muted)", fontFamily: "var(--font-display)", fontWeight: 600 }}>{g.home_score} : {g.away_score}</div>
                </div>
              </div>

              {/* Individual Player Points */}
              <div className="text-right">
                <div className="mb-1 text-[10px] font-semibold uppercase leading-none" style={{ color: "var(--muted)" }}>PTS</div>
                <div className="text-2xl leading-none" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{s.points ?? 0}</div>
              </div>
            </Link>
          );
        })}

        {rows.length === 0 && (
          <div className="py-10 text-center text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)", background: "var(--navy-800)", borderColor: "var(--line)", borderRadius: "var(--radius)", borderStyle: "dashed", borderWidth: "1px" }}>
            {t("player_no_data")}
          </div>
        )}
      </div>
      </div>
    </main>
  );
}