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
}: ShareCardProps) {
  const finalScore = `${homeScore ?? "-"} : ${awayScore ?? "-"}`;
  const athleticFont = '"Roboto Condensed", "Arial Narrow Bold", "Franklin Gothic Heavy", Impact, sans-serif';

  return (
    <div
      style={{ width: "1080px", height: `${cardHeight}px` }}
      className="relative overflow-hidden text-white"
    >
      <div className="absolute inset-0 bg-[#050A18]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,_rgba(255,140,0,0.18),_transparent_38%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_75%,_rgba(59,130,246,0.12),_transparent_40%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_22%,_rgba(255,255,255,0.02)_100%)]" />

      <div className="relative z-10 flex h-full flex-col px-14 pb-12 pt-12">
        <div className="flex justify-end">
          <div className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-black tracking-[0.14em] text-white/90 backdrop-blur-sm">
            ligabasket.md
          </div>
        </div>

        <div className="mt-8 flex flex-1 flex-col">
          <div className="text-center">
            <p className="text-[13px] font-black uppercase tracking-[0.32em] text-white/70">Post-Game Summary</p>
            <p
              className="mt-3 text-[212px] leading-[0.86] font-black tracking-tight text-[#FF8C00]"
              style={{ fontFamily: athleticFont }}
            >
              {finalScore}
            </p>
          </div>

          <div className="mt-8 grid flex-1 grid-cols-2 gap-8">
            <div className="rounded-[30px] border border-white/12 bg-white/[0.035] px-8 py-10 text-center shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
              <div className="mx-auto flex h-[120px] w-[120px] items-center justify-center rounded-full border border-white/20 bg-[#0b1328] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                <TeamLogo
                  teamId={homeTeamId}
                  teamName={homeTeamName}
                  size={96}
                  className="h-24 w-24 object-contain"
                />
              </div>
              <p
                className="mt-8 text-[54px] font-black uppercase leading-[0.9] tracking-tight text-white break-words"
                style={{ fontFamily: athleticFont }}
              >
                {homeTeamName}
              </p>
            </div>

            <div className="rounded-[30px] border border-white/12 bg-white/[0.035] px-8 py-10 text-center shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
              <div className="mx-auto flex h-[120px] w-[120px] items-center justify-center rounded-full border border-white/20 bg-[#0b1328] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                <TeamLogo
                  teamId={awayTeamId}
                  teamName={awayTeamName}
                  size={96}
                  className="h-24 w-24 object-contain"
                />
              </div>
              <p
                className="mt-8 text-[54px] font-black uppercase leading-[0.9] tracking-tight text-white break-words"
                style={{ fontFamily: athleticFont }}
              >
                {awayTeamName}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[26px] border border-white/20 bg-white/[0.07] px-8 py-7 shadow-[0_20px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-[12px] font-black uppercase tracking-[0.24em] text-white/50">Date</p>
                <p className="mt-3 text-[33px] font-black leading-tight text-white">{dateLabel}</p>
              </div>

              <div className="text-center">
                <p className="text-[12px] font-black uppercase tracking-[0.24em] text-white/50">Venue</p>
                <p className="mt-3 text-[33px] font-black leading-tight break-words text-white">{venue ?? "TBD"}</p>
              </div>

              <div className="text-center">
                <p className="text-[12px] font-black uppercase tracking-[0.24em] text-white/50">Season</p>
                <p className="mt-3 text-[33px] font-black leading-tight text-white">{season ?? "Current"}</p>
              </div>
            </div>
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
          />
        </div>
      </div>
    </>
  );
}
