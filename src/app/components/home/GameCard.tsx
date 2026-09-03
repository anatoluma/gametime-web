import Link from "next/link";
import Crest from "@/app/components/home/Crest";
import { getWinner } from "@/lib/get-winner";
import type { TranslationKey } from "@/lib/i18n";

type Game = {
  game_id: string;
  tipoff: string | null;
  home_score: number | null;
  away_score: number | null;
  home_team_id: string;
  away_team_id: string;
};

type Team = { name: string; logoUrl: string | null };

type Props = {
  game: Game;
  teamMap: Map<string, Team>;
  t: (key: TranslationKey) => string;
};

export default function GameCard({ game, teamMap, t }: Props) {
  const dateObj = game.tipoff ? new Date(game.tipoff) : null;
  const isFinished = game.home_score !== null && game.away_score !== null && dateObj !== null && dateObj < new Date();
  const timeText = dateObj
    ? dateObj.toLocaleTimeString("ro-RO", { timeZone: "Europe/Chisinau", hour: "2-digit", minute: "2-digit" })
    : "TBD";
  const winner = getWinner(game.home_score, game.away_score);
  const homeTeam = teamMap.get(game.home_team_id);
  const awayTeam = teamMap.get(game.away_team_id);
  const homeName = homeTeam?.name ?? game.home_team_id;
  const awayName = awayTeam?.name ?? game.away_team_id;

  return (
    <Link
      href={`/games/${game.game_id}`}
      className="block border px-3 py-3 transition-colors hover:border-[var(--orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)]"
      style={{
        borderColor: "var(--line)",
        borderRadius: "var(--radius)",
        background: "var(--navy-800)",
        borderLeft: "3px solid var(--orange)",
      }}
    >
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1" style={{ color: "var(--muted)" }}>
          <span>{dateObj ? dateObj.toLocaleDateString("ro-RO", { timeZone: "Europe/Chisinau", month: "short", day: "numeric" }) : ""}</span>
          <span>•</span>
          <span>{timeText}</span>
        </div>
        <span style={{ color: isFinished ? "var(--win)" : "var(--orange)" }}>
          {isFinished ? t("status_final") : t("status_scheduled")}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Crest teamId={game.home_team_id} teamName={homeName} logoUrl={homeTeam?.logoUrl} size={26} />
            <span className={`truncate text-xs uppercase ${winner === "home" ? "font-bold" : "font-semibold"}`} style={{ color: winner === "home" ? "var(--text)" : "var(--lose)" }}>
              {homeName}
            </span>
          </div>
          {isFinished ? <span className="text-right" style={{ color: winner === "home" ? "var(--orange)" : "var(--lose)", fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: winner === "home" ? 700 : 500 }}>{game.home_score}</span> : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Crest teamId={game.away_team_id} teamName={awayName} logoUrl={awayTeam?.logoUrl} size={26} />
            <span className={`truncate text-xs uppercase ${winner === "away" ? "font-bold" : "font-semibold"}`} style={{ color: winner === "away" ? "var(--text)" : "var(--lose)" }}>
              {awayName}
            </span>
          </div>
          {isFinished ? <span className="text-right" style={{ color: winner === "away" ? "var(--orange)" : "var(--lose)", fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: winner === "away" ? 700 : 500 }}>{game.away_score}</span> : null}
        </div>
      </div>
    </Link>
  );
}
