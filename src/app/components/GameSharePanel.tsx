"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import TeamLogo from "@/app/components/TeamLogo";

type GameSharePanelProps = {
  gameId: string;
  season: string | null;
  tipoff: string | null;
  venue: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
};

type ShareCardProps = {
  season: string | null;
  dateLabel: string;
  venue: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  cardHeight: number;
  isStory: boolean;
};

const STORY_EXPORT = { width: 1080, height: 1920, label: "Save Story image" };

function formatDateLabel(tipoff: string | null) {
  if (!tipoff) return "Date TBD";

  return new Date(tipoff).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ShareCard({
  season,
  dateLabel,
  venue,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  cardHeight,
  isStory,
}: ShareCardProps) {
  return (
    <div
      style={{ width: "1080px", height: `${cardHeight}px` }}
      className="relative overflow-hidden bg-slate-950 text-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#f97316_0%,_rgba(249,115,22,0.15)_35%,_transparent_65%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(160deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] opacity-95" />

      <div className={`relative z-10 flex h-full flex-col ${isStory ? "px-16 py-20" : "px-14 py-14"}`}>
        <div className="inline-flex items-center self-start rounded-full border border-orange-500/40 bg-black/50 px-5 py-2 text-sm font-black uppercase tracking-[0.25em] text-orange-400">
          GameTime Final
        </div>

        <div className={`${isStory ? "mt-16" : "mt-10"} rounded-[32px] border border-white/10 bg-black/45 p-8 backdrop-blur-sm`}>
          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-8">
            <TeamLogo
              teamId={homeTeamId}
              teamName={homeTeamName}
              size={isStory ? 164 : 140}
              className={`${isStory ? "h-36 w-36" : "h-28 w-28"} object-contain`}
            />
            <div className={`${isStory ? "text-6xl" : "text-5xl"} font-black uppercase leading-none tracking-tight break-words`}>
              {homeTeamName}
            </div>
            <div className={`${isStory ? "text-8xl" : "text-7xl"} font-black tabular-nums text-orange-400`}>
              {homeScore ?? "-"}
            </div>
          </div>

          <div className={`${isStory ? "my-10" : "my-8"} h-px bg-white/20`} />

          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-8">
            <TeamLogo
              teamId={awayTeamId}
              teamName={awayTeamName}
              size={isStory ? 164 : 140}
              className={`${isStory ? "h-36 w-36" : "h-28 w-28"} object-contain`}
            />
            <div className={`${isStory ? "text-6xl" : "text-5xl"} font-black uppercase leading-none tracking-tight break-words`}>
              {awayTeamName}
            </div>
            <div className={`${isStory ? "text-8xl" : "text-7xl"} font-black tabular-nums text-orange-400`}>
              {awayScore ?? "-"}
            </div>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-4 rounded-2xl border border-white/15 bg-black/40 px-6 py-5 text-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400">Date</p>
            <p className={`${isStory ? "text-xl" : "text-lg"} mt-2 font-black`}>{dateLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400">Venue</p>
            <p className={`${isStory ? "text-xl" : "text-lg"} mt-2 font-black break-words`}>{venue ?? "TBD"}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400">Season</p>
            <p className={`${isStory ? "text-xl" : "text-lg"} mt-2 font-black`}>{season ?? "Current"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GameSharePanel({
  gameId,
  season,
  tipoff,
  venue,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
}: GameSharePanelProps) {
  const [status, setStatus] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const storyCardRef = useRef<HTMLDivElement | null>(null);

  const dateLabel = useMemo(() => formatDateLabel(tipoff), [tipoff]);
  const hasFinalScore = homeScore !== null && awayScore !== null;

  async function downloadShareImage() {
    if (!hasFinalScore) return;

    if (!storyCardRef.current) return;

    setIsExporting(true);
    setStatus("Preparing image...");

    try {
      const dataUrl = await toPng(storyCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        canvasWidth: STORY_EXPORT.width,
        canvasHeight: STORY_EXPORT.height,
        skipAutoScale: true,
      });

      const link = document.createElement("a");
      link.download = `gametime-${gameId}-story.png`;
      link.href = dataUrl;
      link.click();

      setStatus("Story image downloaded.");
    } catch {
      setStatus("Image export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {status && (
          <div className="rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-orange-300 shadow-lg backdrop-blur-sm">
            {status}
          </div>
        )}

        <button
          type="button"
          onClick={downloadShareImage}
          disabled={!hasFinalScore || isExporting}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur-sm transition hover:border-orange-500 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          title={hasFinalScore ? STORY_EXPORT.label : "Save available after final score"}
          aria-label={hasFinalScore ? STORY_EXPORT.label : "Save available after final score"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          <span className="sr-only">{isExporting ? "Exporting story image" : STORY_EXPORT.label}</span>
        </button>
      </div>

      {!hasFinalScore && (
        <span className="sr-only">Share export unlocks when final score is available.</span>
      )}

      <div className="pointer-events-none absolute -left-[99999px] -top-[99999px]">
        <div ref={storyCardRef}>
          <ShareCard
            season={season}
            dateLabel={dateLabel}
            venue={venue}
            homeTeamId={homeTeamId}
            awayTeamId={awayTeamId}
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            homeScore={homeScore}
            awayScore={awayScore}
            cardHeight={1920}
            isStory
          />
        </div>
      </div>
    </>
  );
}
