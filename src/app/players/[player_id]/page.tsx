"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PlayerAvatar from "@/app/components/PlayerAvatar";
import SeasonSelector from "@/app/components/SeasonSelector";
import { useT } from "@/app/components/LanguageProvider";
import type { Season } from "@/lib/league";
import SectionHeading from "@/app/components/home/SectionHeading";

type Player = {
  player_id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  photo_url: string | null;
};

type Team = {
  team_id: string;
  team_name: string;
};

// One row per (player, season) from the player_season_stats DB view
type SeasonStatRow = {
  season: string;
  gp: number;
  pts: number | null;
  ppg: number | null;
  reb: number | null;
  rpg: number | null;
  ast: number | null;
  apg: number | null;
  stl: number | null;
  spg: number | null;
  blk: number | null;
  bpg: number | null;
  fg_made: number | null;
  fg_att: number | null;
  fg_pct: number | null;
  three_made: number | null;
  three_att: number | null;
  three_pct: number | null;
  ft_made: number | null;
  ft_att: number | null;
  ft_pct: number | null;
};

// Career totals from the player_career_stats DB view (same shape, no season)
type CareerStatRow = Omit<SeasonStatRow, "season">;

const EMPTY_SEASON_STATS: SeasonStatRow = {
  season: "", gp: 0, pts: 0, ppg: 0, reb: 0, rpg: 0, ast: 0, apg: 0, stl: 0, spg: 0,
  blk: 0, bpg: 0, fg_made: 0, fg_att: 0, fg_pct: 0, three_made: 0, three_att: 0,
  three_pct: 0, ft_made: 0, ft_att: 0, ft_pct: 0,
};

type GameStatRow = {
  game_id: string;
  points: number | null;
  reb_tot: number | null;
  assists: number | null;
};

type GameRow = {
  game_id: string;
  season: string | null;
  tipoff: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

function pct(v: number | null) {
  return (v ?? 0).toFixed(1);
}

function avg(v: number | null) {
  return (v ?? 0).toFixed(1);
}

export default function PlayerPage() {
  const params = useParams();
  const { t } = useT();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const playerId = useMemo(() => {
    const raw = (params as any)?.player_id;
    if (Array.isArray(raw)) return raw[0] ?? "";
    return raw ?? "";
  }, [params]);

  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonStats, setSeasonStats] = useState<SeasonStatRow[]>([]);
  const [careerStats, setCareerStats] = useState<CareerStatRow | null>(null);
  const [gameStats, setGameStats] = useState<GameStatRow[]>([]);
  const [gamesById, setGamesById] = useState<Record<string, GameRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const seasonParam = searchParams.get("season");
  const currentSeason = seasonParam ?? seasons.find((s) => s.is_current)?.season ?? seasons[0]?.season ?? "2025/26";

  // Load available seasons once
  useEffect(() => {
    supabase
      .from("seasons")
      .select("season, is_current")
      .order("season", { ascending: false })
      .then(({ data }) => setSeasons((data ?? []) as Season[]));
  }, []);

  // When seasons load and there's no URL param, set the default in the URL
  useEffect(() => {
    if (seasonParam || seasons.length === 0) return;
    const defaultSeason = seasons.find((s) => s.is_current)?.season ?? seasons[0]?.season;
    if (!defaultSeason) return;
    const params2 = new URLSearchParams(searchParams.toString());
    params2.set("season", defaultSeason);
    router.replace(`${pathname}?${params2.toString()}`);
  }, [seasons, seasonParam, pathname, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!playerId) return;
      setLoading(true);
      setError(null);

      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("player_id, team_id, first_name, last_name, jersey_number, photo_url")
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

      const [seasonStatsRes, careerStatsRes] = await Promise.all([
        supabase.from("player_season_stats").select("*").eq("player_id", playerId),
        supabase.from("player_career_stats").select("*").eq("player_id", playerId).maybeSingle(),
      ]);

      if (cancelled) return;
      if (seasonStatsRes.error) {
        setError(seasonStatsRes.error);
        setLoading(false);
        return;
      }

      setSeasonStats((seasonStatsRes.data ?? []) as SeasonStatRow[]);
      setCareerStats((careerStatsRes.data as CareerStatRow) ?? null);

      const gameLogResponse = await fetch(`/api/players/${encodeURIComponent(playerId)}/game-log`);
      const gameLog = await gameLogResponse.json();

      if (cancelled) return;
      if (!gameLogResponse.ok) {
        setError({ message: gameLog.error ?? "Failed to load game log" });
        setLoading(false);
        return;
      }

      setGameStats(gameLog.stats as GameStatRow[]);
      const map: Record<string, GameRow> = {};
      (gameLog.games as GameRow[]).forEach((game) => (map[game.game_id] = game));
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

  const headerStats = seasonStats.find((s) => s.season === currentSeason) ?? EMPTY_SEASON_STATS;

  const seasonRows = [...seasonStats].sort((a, b) => {
    const ia = seasons.findIndex((s) => s.season === a.season);
    const ib = seasons.findIndex((s) => s.season === b.season);
    if (ia !== -1 && ib !== -1) return ia - ib;
    return b.season.localeCompare(a.season);
  });

  const rows = gameStats
    .filter((s) => gamesById[s.game_id]?.season === currentSeason)
    .sort((a, b) => {
      const da = gamesById[a.game_id]?.tipoff ? new Date(gamesById[a.game_id].tipoff!).getTime() : -Infinity;
      const db = gamesById[b.game_id]?.tipoff ? new Date(gamesById[b.game_id].tipoff!).getTime() : -Infinity;
      return db - da;
    });

  return (
    <main className="min-h-screen px-3 py-4 sm:px-6" style={{ background: "var(--navy-950)", color: "var(--text)" }}>
      <div className="mx-auto max-w-5xl">
      {/* Header Section */}
      <div className="mb-6 flex flex-col justify-between gap-6 border-b pb-6 md:flex-row md:items-end" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-end gap-4">
          <PlayerAvatar
            playerId={player.player_id}
            playerName={`${player.first_name} ${player.last_name}`}
            photoUrl={player.photo_url}
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

        {seasons.length > 0 && currentSeason && (
          <SeasonSelector seasons={seasons} currentSeason={currentSeason} />
        )}
      </div>

      {/* Quick Stats Cards for the selected season */}
      <div className="mb-8 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {[
          { label: t("player_stat_gp"), value: String(headerStats.gp), accent: false },
          { label: t("player_stat_ppg"), value: avg(headerStats.ppg), accent: true },
          { label: t("player_stat_rpg"), value: avg(headerStats.rpg), accent: true },
          { label: t("player_stat_apg"), value: avg(headerStats.apg), accent: true },
          { label: t("player_stat_spg"), value: avg(headerStats.spg), accent: false },
          { label: t("player_stat_bpg"), value: avg(headerStats.bpg), accent: false },
          { label: t("player_stat_fg_pct"), value: `${pct(headerStats.fg_pct)}%`, accent: false },
        ].map((card) => (
          <div key={card.label} className="border p-3 text-center" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}>
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{card.label}</div>
            <div className="text-xl leading-none sm:text-2xl" style={{ color: card.accent ? "var(--orange)" : "var(--text)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* SEASON STATS TABLE */}
      <SectionHeading title={t("player_season_stats_title")} href="/leaders" linkLabel={t("nav_leaders")} headingClassName="text-lg" />
      <div className="mb-8 overflow-x-auto border" style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--navy-800)" }}>
        <table className="w-full min-w-[720px] text-center text-sm">
          <thead>
            <tr className="text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
              <th className="px-3 py-2 text-left">Season</th>
              <th className="px-3 py-2">{t("player_stat_gp")}</th>
              <th className="px-3 py-2">PTS</th>
              <th className="px-3 py-2">{t("player_stat_rpg")}</th>
              <th className="px-3 py-2">{t("player_stat_apg")}</th>
              <th className="px-3 py-2">{t("player_stat_spg")}</th>
              <th className="px-3 py-2">{t("player_stat_bpg")}</th>
              <th className="px-3 py-2">{t("player_stat_fg_pct")}</th>
              <th className="px-3 py-2">{t("player_stat_3pm")}</th>
              <th className="px-3 py-2">{t("player_stat_3p_pct")}</th>
              <th className="px-3 py-2">{t("player_stat_ft_pct")}</th>
            </tr>
          </thead>
          <tbody>
            {seasonRows.map((s) => (
              <tr key={s.season} className="border-t tabular-nums" style={{ borderColor: "var(--line)" }}>
                <td className="px-3 py-2 text-left font-semibold" style={{ fontFamily: "var(--font-display)" }}>{s.season}</td>
                <td className="px-3 py-2">{s.gp}</td>
                <td className="px-3 py-2 font-semibold" style={{ color: "var(--orange)" }}>{avg(s.ppg)}</td>
                <td className="px-3 py-2">{avg(s.rpg)}</td>
                <td className="px-3 py-2">{avg(s.apg)}</td>
                <td className="px-3 py-2">{avg(s.spg)}</td>
                <td className="px-3 py-2">{avg(s.bpg)}</td>
                <td className="px-3 py-2">{pct(s.fg_pct)}</td>
                <td className="px-3 py-2">{s.three_made ?? 0}</td>
                <td className="px-3 py-2">{pct(s.three_pct)}</td>
                <td className="px-3 py-2">{pct(s.ft_pct)}</td>
              </tr>
            ))}
            {careerStats && (
              <tr className="border-t tabular-nums" style={{ borderColor: "var(--line)", background: "var(--navy-950)" }}>
                <td className="px-3 py-2 text-left font-semibold uppercase" style={{ color: "var(--muted)" }}>{t("player_career_row_label")}</td>
                <td className="px-3 py-2">{careerStats.gp}</td>
                <td className="px-3 py-2 font-semibold" style={{ color: "var(--orange)" }}>{avg(careerStats.ppg)}</td>
                <td className="px-3 py-2">{avg(careerStats.rpg)}</td>
                <td className="px-3 py-2">{avg(careerStats.apg)}</td>
                <td className="px-3 py-2">{avg(careerStats.spg)}</td>
                <td className="px-3 py-2">{avg(careerStats.bpg)}</td>
                <td className="px-3 py-2">{pct(careerStats.fg_pct)}</td>
                <td className="px-3 py-2">{careerStats.three_made ?? 0}</td>
                <td className="px-3 py-2">{pct(careerStats.three_pct)}</td>
                <td className="px-3 py-2">{pct(careerStats.ft_pct)}</td>
              </tr>
            )}
            {seasonRows.length === 0 && !careerStats && (
              <tr>
                <td colSpan={11} className="py-6 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>{t("player_no_data")}</td>
              </tr>
            )}
          </tbody>
        </table>
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

              {/* Individual Player PTS / REB / AST */}
              <div className="flex items-center gap-3">
                <div className="text-center w-[36px]">
                  <div className="mb-1 text-[9px] font-semibold uppercase leading-none" style={{ color: "var(--muted)" }}>PTS</div>
                  <div className="text-xl leading-none" style={{ color: "var(--orange)", fontFamily: "var(--font-display)", fontWeight: 700 }}>{s.points ?? 0}</div>
                </div>
                <div className="text-center w-[36px]">
                  <div className="mb-1 text-[9px] font-semibold uppercase leading-none" style={{ color: "var(--muted)" }}>REB</div>
                  <div className="text-xl leading-none" style={{ color: "var(--text)", fontFamily: "var(--font-display)", fontWeight: 600 }}>{s.reb_tot ?? 0}</div>
                </div>
                <div className="text-center w-[36px]">
                  <div className="mb-1 text-[9px] font-semibold uppercase leading-none" style={{ color: "var(--muted)" }}>AST</div>
                  <div className="text-xl leading-none" style={{ color: "var(--text)", fontFamily: "var(--font-display)", fontWeight: 600 }}>{s.assists ?? 0}</div>
                </div>
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