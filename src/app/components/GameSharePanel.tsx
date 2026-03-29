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

  return (
    <div
      style={{ width: "1080px", height: `${cardHeight}px` }}
      className="relative overflow-hidden bg-slate-950 text-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.45)_0%,_rgba(249,115,22,0.14)_25%,_transparent_58%)]" />
      <div className="absolute -left-28 top-20 h-80 w-80 rounded-full bg-blue-500/10 blur-[90px]" />
      <div className="absolute bottom-24 right-20 h-64 w-64 rounded-full bg-orange-500/10 blur-[85px]" />
      <div className="absolute inset-0 bg-[linear-gradient(150deg,_#020617_0%,_#071336_42%,_#0b1731_100%)] opacity-95" />

      <div className="relative z-10 flex h-full flex-col px-16 py-14">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-3 rounded-full border border-orange-500/40 bg-black/45 px-5 py-2 text-sm font-black uppercase tracking-[0.22em] text-orange-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 4h10" />
              <path d="M17 4v2a5 5 0 0 1-10 0V4" />
              <path d="M5 7a2 2 0 0 1-2-2V4h4" />
              <path d="M19 7a2 2 0 0 0 2-2V4h-4" />
            </svg>
            GameTime Final
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-4 py-2 text-xs font-black tracking-[0.18em] text-white/90">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
            </svg>
            ligabasket.md
          </div>
        </div>

        <div className="mt-8 flex flex-1 flex-col">
          <div className="flex-1 rounded-[36px] border border-white/12 bg-black/40 px-10 py-10 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-md">
            <div className="grid h-full grid-rows-[auto_auto_1fr]">
              <div className="text-center">
                <p className="text-[12px] font-black uppercase tracking-[0.28em] text-white/60">Final Score</p>
                <p className="mt-2 text-[158px] leading-[0.92] font-black tabular-nums tracking-tight text-orange-400">{finalScore}</p>
              </div>

              <div className="my-7 h-px bg-white/15" />

              <div className="grid grid-cols-2 gap-8">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-40 w-40 items-center justify-center">
                    <TeamLogo
                      teamId={homeTeamId}
                      teamName={homeTeamName}
                      size={164}
                      className="h-36 w-36 object-contain"
                    />
                  </div>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">Home</p>
                  <p className="mt-2 text-[52px] font-black uppercase leading-[0.95] tracking-tight break-words">{homeTeamName}</p>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="flex h-40 w-40 items-center justify-center">
                    <TeamLogo
                      teamId={awayTeamId}
                      teamName={awayTeamName}
                      size={164}
                      className="h-36 w-36 object-contain"
                    />
                  </div>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">Away</p>
                  <p className="mt-2 text-[52px] font-black uppercase leading-[0.95] tracking-tight break-words">{awayTeamName}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-5 rounded-2xl border border-white/12 bg-black/45 px-7 py-6 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/[0.03] text-white/70">
                <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 2v4" />
                  <path d="M16 2v4" />
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M3 10h18" />
                </svg>
              </div>
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">Date</p>
              <p className="mt-2 text-[30px] font-black leading-tight">{dateLabel}</p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/[0.03] text-white/70">
                <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                </svg>
              </div>
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">Venue</p>
              <p className="mt-2 text-[30px] font-black leading-tight break-words">{venue ?? "TBD"}</p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/[0.03] text-white/70">
                <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m4 7 8-4 8 4-8 4-8-4Z" />
                  <path d="m4 12 8 4 8-4" />
                  <path d="m4 17 8 4 8-4" />
                </svg>
              </div>
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.22em] text-white/55">Season</p>
              <p className="mt-2 text-[30px] font-black leading-tight">{season ?? "Current"}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-3 text-white/90">
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
            </svg>
            <span className="text-2xl font-black tracking-[0.16em]">ligabasket.md</span>
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
