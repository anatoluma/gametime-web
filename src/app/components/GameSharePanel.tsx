/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";

// ─── Font stacks (loaded globally via Google Fonts in layout.tsx) ─────────────
const BEBAS = '"Bebas Neue", Impact, serif';
const BARLOW = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';

// ─── Types ────────────────────────────────────────────────────────────────────
export type GameSharePanelProps = {
  gameId: string;
  homeTeam: { name: string; logoUrl: string };
  awayTeam: { name: string; logoUrl: string };
  homeScore: number;
  awayScore: number;
  venue: string;
  date: string;
  season: string;
  topScorer: { name: string; points: number; teamName: string } | null;
};

type ShareCardProps = Omit<GameSharePanelProps, "gameId">;

// ─── Team Column ──────────────────────────────────────────────────────────────
function TeamColumn({
  team,
  isWinner,
  role,
}: {
  team: { name: string; logoUrl: string };
  isWinner: boolean;
  role: "HOME" | "AWAY";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "9px" }}>
      {/* Outer wrapper keeps badge from being clipped by overflow:hidden */}
      <div style={{ position: "relative", width: "74px", height: "74px", flexShrink: 0 }}>
        {/* Logo circle */}
        <div
          style={{
            width: "74px",
            height: "74px",
            borderRadius: "50%",
            border: isWinner
              ? "2px solid rgba(255,140,0,0.45)"
              : "2px solid rgba(255,255,255,0.08)",
            background: isWinner ? "rgba(255,140,0,0.06)" : "rgba(255,255,255,0.04)",
            boxShadow: isWinner ? "0 0 28px rgba(255,130,0,0.18)" : "none",
            overflow: "hidden",
          }}
        >
          <img
            src={team.logoUrl}
            alt={team.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "50%",
              display: "block",
            }}
          />
        </div>

        {/* Winner checkmark badge */}
        {isWinner && (
          <div
            style={{
              position: "absolute",
              top: "-3px",
              right: "-3px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "#FF8C00",
              border: "2px solid #0d0d14",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "9px",
              fontWeight: 900,
              color: "#000",
              fontFamily: BARLOW,
              lineHeight: 1,
            }}
          >
            ✓
          </div>
        )}
      </div>

      {/* Team name */}
      <div
        style={{
          fontFamily: BARLOW,
          fontSize: "13px",
          fontWeight: 800,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.85)",
          textAlign: "center",
          lineHeight: 1.25,
        }}
      >
        {team.name}
      </div>

      {/* Role label */}
      <div
        style={{
          fontFamily: BARLOW,
          fontSize: "8.5px",
          fontWeight: 700,
          letterSpacing: "1.8px",
          textTransform: "uppercase",
          color: isWinner ? "rgba(255,140,0,0.6)" : "rgba(255,255,255,0.22)",
        }}
      >
        {isWinner ? `${role} · WINNER` : role}
      </div>
    </div>
  );
}

// ─── Share Card (420×720 export canvas) ───────────────────────────────────────
function ShareCard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  venue,
  date,
  season,
  topScorer,
}: ShareCardProps) {
  const homeWins = homeScore > awayScore;
  const margin = Math.abs(homeScore - awayScore);

  return (
    <div
      id="share-card"
      style={{
        position: "relative",
        width: "420px",
        height: "720px",
        backgroundColor: "#0d0d14",
        borderRadius: "24px",
        overflow: "hidden",
        fontFamily: BARLOW,
        color: "#fff",
      }}
    >
      {/* ── Background layers (z-index 0, pointer-events none) ── */}

      {/* Court circle outer */}
      <div
        style={{
          position: "absolute",
          width: "420px",
          height: "420px",
          borderRadius: "50%",
          border: "1px solid rgba(255,140,0,0.06)",
          top: "40px",
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Court circle inner */}
      <div
        style={{
          position: "absolute",
          width: "340px",
          height: "340px",
          borderRadius: "50%",
          border: "1px solid rgba(255,140,0,0.06)",
          top: "80px",
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Top glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "280px",
          background: "radial-gradient(ellipse at top center, rgba(255,130,0,0.09), transparent)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Bottom fade */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "220px",
          background: "linear-gradient(to top, rgba(5,5,12,0.98), transparent)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Top accent line (animation defined in globals.css) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background:
            "linear-gradient(90deg, transparent, #FF8C00 25%, #FFB800 50%, #FF8C00 75%, transparent)",
          animation: "accentPulse 2.5s ease-in-out infinite",
          zIndex: 20,
          pointerEvents: "none",
        }}
      />

      {/* ── Content (z-index 10) ── */}
      <div style={{ position: "relative", zIndex: 10, height: "100%" }}>

        {/* SECTION 1 — HEADER */}
        <div
          style={{
            padding: "20px 24px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              background: "rgba(255,140,0,0.12)",
              border: "1px solid rgba(255,140,0,0.3)",
              borderRadius: "20px",
              padding: "5px 13px",
              fontFamily: BARLOW,
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "2.5px",
              textTransform: "uppercase",
              color: "#FF8C00",
            }}
          >
            ⚡ Final Result
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: BARLOW, fontSize: "14px", fontWeight: 700, letterSpacing: "1px" }}>
              <span style={{ color: "rgba(255,255,255,0.85)" }}>liga</span>
              <span style={{ color: "#FF8C00" }}>basket</span>
              <span style={{ color: "rgba(255,255,255,0.85)" }}>.md</span>
            </div>
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "8px",
                fontWeight: 600,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.25)",
              }}
            >
              Basketball League
            </div>
          </div>
        </div>

        {/* SECTION 2 — SCORE */}
        <div
          style={{
            paddingTop: "8px",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
          }}
        >
          <span
            style={{
              fontFamily: BEBAS,
              fontSize: "124px",
              lineHeight: 1,
              color: homeWins ? "#FF8C00" : "rgba(255,255,255,0.35)",
              textShadow: homeWins ? "0 0 60px rgba(255,130,0,0.35)" : "none",
            }}
          >
            {homeScore}
          </span>
          <span
            style={{
              fontFamily: BEBAS,
              fontSize: "76px",
              lineHeight: 1,
              color: "rgba(255,255,255,0.13)",
              padding: "0 6px 6px",
            }}
          >
            :
          </span>
          <span
            style={{
              fontFamily: BEBAS,
              fontSize: "124px",
              lineHeight: 1,
              color: !homeWins ? "#FF8C00" : "rgba(255,255,255,0.35)",
              textShadow: !homeWins ? "0 0 60px rgba(255,130,0,0.35)" : "none",
            }}
          >
            {awayScore}
          </span>
        </div>

        {/* SECTION 3 — TEAMS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 40px 1fr",
            padding: "2px 32px 0",
          }}
        >
          <TeamColumn team={homeTeam} isWinner={homeWins} role="HOME" />

          {/* VS divider */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
            }}
          >
            <div
              style={{
                width: "1px",
                height: "22px",
                background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.1), transparent)",
              }}
            />
            <span
              style={{
                fontFamily: BARLOW,
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "2px",
                color: "rgba(255,255,255,0.16)",
              }}
            >
              VS
            </span>
            <div
              style={{
                width: "1px",
                height: "22px",
                background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.1), transparent)",
              }}
            />
          </div>

          <TeamColumn team={awayTeam} isWinner={!homeWins} role="AWAY" />
        </div>

        {/* SECTION 4 — TOP SCORER SPOTLIGHT */}
        {topScorer && (
          <div
            style={{
              margin: "26px 24px 0",
              borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(255,140,0,0.1) 0%, rgba(255,140,0,0.04) 100%)",
              border: "1px solid rgba(255,140,0,0.22)",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <div
                style={{
                  fontFamily: BARLOW,
                  fontSize: "8px",
                  fontWeight: 700,
                  letterSpacing: "2.5px",
                  textTransform: "uppercase",
                  color: "#FF8C00",
                  opacity: 0.8,
                }}
              >
                ★ Top Scorer
              </div>
              <div
                style={{
                  fontFamily: BEBAS,
                  fontSize: "32px",
                  color: "#fff",
                  letterSpacing: "1px",
                  lineHeight: 1,
                }}
              >
                {topScorer.name}
              </div>
              <div
                style={{
                  fontFamily: BARLOW,
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                {topScorer.teamName}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, gap: "2px" }}>
              <span
                style={{
                  fontFamily: BEBAS,
                  fontSize: "56px",
                  color: "#FF8C00",
                  lineHeight: "0.85",
                  display: "block",
                  textShadow: "0 0 30px rgba(255,130,0,0.4)",
                }}
              >
                {topScorer.points}
              </span>
              <span
                style={{
                  fontFamily: BARLOW,
                  fontSize: "8px",
                  fontWeight: 700,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: "rgba(255,140,0,0.5)",
                  display: "block",
                }}
              >
                POINTS
              </span>
            </div>
          </div>
        )}

        {/* SECTION 5 — INFO STRIP */}
        <div
          style={{
            margin: "16px 24px 0",
            borderRadius: "14px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.025)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          <div style={{ padding: "12px 8px", textAlign: "center" }}>
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "8px",
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.25)",
              }}
            >
              VENUE
            </div>
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "13px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.8)",
                marginTop: "2px",
              }}
            >
              {venue}
            </div>
          </div>

          <div
            style={{
              padding: "12px 8px",
              textAlign: "center",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "8px",
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.25)",
              }}
            >
              MARGIN
            </div>
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "13px",
                fontWeight: 700,
                color: "#FF8C00",
                marginTop: "2px",
              }}
            >
              +{margin} pts
            </div>
          </div>
        </div>

        {/* SECTION 6 — FOOTER */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "20px 24px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  background: "#FF8C00",
                  opacity: 0.5,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontFamily: BARLOW, fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
                {date}
              </span>
              <span style={{ fontFamily: BARLOW, fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.35)" }}>
                · {venue}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  background: "#FF8C00",
                  opacity: 0.5,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontFamily: BARLOW, fontSize: "11px", fontWeight: 500, color: "rgba(255,255,255,0.35)" }}>
                Season {season}
              </span>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,140,0,0.1)",
              border: "1px solid rgba(255,140,0,0.22)",
              color: "#FF8C00",
              fontFamily: BARLOW,
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "1px",
              padding: "6px 13px",
              borderRadius: "10px",
              flexShrink: 0,
            }}
          >
            ligabasket.md
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export — button + hidden card ───────────────────────────────────────
export default function GameSharePanel({
  gameId,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  venue,
  date,
  season,
  topScorer,
}: GameSharePanelProps) {
  const [status, setStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleDownload() {
    if (!cardRef.current) return;
    setIsExporting(true);
    setStatus("Preparing…");

    try {
      await document.fonts.ready;
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        width: 420,
        height: 720,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#0d0d14",
        logging: false,
      });

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const link = document.createElement("a");
      link.download = `gametime-${gameId}-result.jpg`;
      link.href = dataUrl;
      link.click();

      setStatus("Saved!");
    } catch {
      setStatus("Export failed.");
    } finally {
      setIsExporting(false);
      setTimeout(() => setStatus(""), 3000);
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
          onClick={handleDownload}
          disabled={isExporting}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur-sm transition hover:border-orange-500 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          title="Save result image"
          aria-label="Save result image"
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
          <span className="sr-only">
            {isExporting ? "Exporting…" : "Save result image"}
          </span>
        </button>
      </div>

      {/* Hidden share card — captured by html2canvas */}
      <div className="pointer-events-none absolute -left-[99999px] -top-[99999px]">
        <div ref={cardRef}>
          <ShareCard
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeScore={homeScore}
            awayScore={awayScore}
            venue={venue}
            date={date}
            season={season}
            topScorer={topScorer}
          />
        </div>
      </div>
    </>
  );
}
