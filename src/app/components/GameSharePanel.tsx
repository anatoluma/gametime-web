/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";

const BEBAS = '"Bebas Neue", Impact, serif';
const BARLOW = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';

export type GameSharePanelProps = {
  gameId: string;
  homeTeam: { name: string; logoUrl: string };
  awayTeam: { name: string; logoUrl: string };
  homeScore: number;
  awayScore: number;
  venue: string;
  date: string;
  season: string;
  topPlayers: { home: TopPlayer | null; away: TopPlayer | null };
};

type TopPlayer = {
  name: string;
  teamName: string;
  points: number;
  rebounds: number;
  assists: number;
  efficiency: number;
};

type ShareCardProps = Omit<GameSharePanelProps, "gameId">;

// ─── Compact Player Card ───────────────────────────────────────────────────────
function PlayerCard({ player, teamName }: { player: TopPlayer; teamName: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "28px 32px",
        borderRadius: "20px",
        background: "rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: BARLOW,
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#F97316",
          }}
        >
          {teamName}
        </div>
        <div
          style={{
            fontFamily: BARLOW,
            fontSize: "22px",
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.2,
            marginTop: "6px",
          }}
        >
          {player.name}
        </div>
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: "6px",
        }}
      >
        <span
          style={{
            fontFamily: BEBAS,
            fontSize: "56px",
            lineHeight: 1,
            color: "#F97316",
          }}
        >
          {player.points}
        </span>
        <span
          style={{
            fontFamily: BARLOW,
            fontSize: "17px",
            fontWeight: 700,
            letterSpacing: "1px",
            color: "rgba(249,115,22,0.8)",
          }}
        >
          PTS
        </span>
      </div>
    </div>
  );
}

// ─── Share Card (1080×1920 export canvas) ─────────────────────────────────────
function ShareCard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  venue,
  date,
  season,
  topPlayers,
}: ShareCardProps) {
  const homeWins = homeScore > awayScore;

  return (
    <div
      id="share-card"
      style={{
        position: "relative",
        width: "1080px",
        height: "1920px",
        background: "linear-gradient(170deg, #121826 0%, #0B0F1A 100%)",
        fontFamily: BARLOW,
        color: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Radial center glow */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "1000px",
          height: "1000px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 65%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background:
            "linear-gradient(90deg, transparent, #F97316 30%, #F97316 70%, transparent)",
          opacity: 0.8,
          zIndex: 20,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          height: "100%",
          padding: "80px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── HEADER ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "rgba(249,115,22,0.12)",
              border: "1px solid rgba(249,115,22,0.3)",
              borderRadius: "24px",
              padding: "10px 28px",
              fontFamily: BARLOW,
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "2.5px",
              textTransform: "uppercase",
              color: "#F97316",
            }}
          >
            Final Result
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.85)" }}>liga</span>
              <span style={{ color: "#F97316" }}>basket</span>
              <span style={{ color: "rgba(255,255,255,0.85)" }}>.md</span>
            </div>
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "14px",
                fontWeight: 600,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              Basketball League
            </div>
          </div>
        </div>

        {/* ── SCORE — CENTERPIECE ── */}
        <div
          style={{
            marginTop: "100px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "48px",
          }}
        >
          {/* Home score */}
          <span
            style={{
              fontFamily: BEBAS,
              fontSize: "180px",
              lineHeight: 1,
              color: homeWins ? "#F97316" : "#E5E7EB",
              display: "inline-block",
              transform: homeWins ? "scale(1.05)" : "scale(1)",
              textShadow: homeWins
                ? "0 4px 20px rgba(249,115,22,0.25), 0 0 60px rgba(249,115,22,0.15)"
                : "none",
            }}
          >
            {homeScore}
          </span>

          {/* VS divider with soft glow line */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "1px",
                height: "72px",
                background:
                  "linear-gradient(180deg, transparent, rgba(249,115,22,0.2), rgba(255,255,255,0.08))",
              }}
            />
            <span
              style={{
                fontFamily: BARLOW,
                fontSize: "40px",
                fontWeight: 700,
                letterSpacing: "4px",
                color: "rgba(255,255,255,0.3)",
                lineHeight: 1,
                padding: "8px 0",
              }}
            >
              vs
            </span>
            <div
              style={{
                width: "1px",
                height: "72px",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(249,115,22,0.2), transparent)",
              }}
            />
          </div>

          {/* Away score */}
          <span
            style={{
              fontFamily: BEBAS,
              fontSize: "180px",
              lineHeight: 1,
              color: !homeWins ? "#F97316" : "#E5E7EB",
              display: "inline-block",
              transform: !homeWins ? "scale(1.05)" : "scale(1)",
              textShadow: !homeWins
                ? "0 4px 20px rgba(249,115,22,0.25), 0 0 60px rgba(249,115,22,0.15)"
                : "none",
            }}
          >
            {awayScore}
          </span>
        </div>

        {/* ── TEAMS ── */}
        <div
          style={{
            marginTop: "72px",
            display: "grid",
            gridTemplateColumns: "1fr 80px 1fr",
            alignItems: "flex-start",
          }}
        >
          {/* Home */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <div
              style={{
                width: "130px",
                height: "130px",
                borderRadius: "50%",
                border: homeWins
                  ? "2px solid rgba(249,115,22,0.5)"
                  : "2px solid rgba(255,255,255,0.1)",
                background: homeWins
                  ? "rgba(249,115,22,0.08)"
                  : "rgba(255,255,255,0.04)",
                boxShadow: homeWins
                  ? "0 0 40px rgba(249,115,22,0.18)"
                  : "none",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img
                src={homeTeam.logoUrl}
                alt={homeTeam.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "32px",
                fontWeight: 800,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: homeWins
                  ? "rgba(255,255,255,0.95)"
                  : "rgba(255,255,255,0.6)",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {homeTeam.name}
            </div>
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: homeWins
                  ? "rgba(249,115,22,0.7)"
                  : "rgba(255,255,255,0.25)",
              }}
            >
              {homeWins ? "HOME · WINNER" : "HOME"}
            </div>
          </div>

          {/* Center spacer */}
          <div />

          {/* Away */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <div
              style={{
                width: "130px",
                height: "130px",
                borderRadius: "50%",
                border: !homeWins
                  ? "2px solid rgba(249,115,22,0.5)"
                  : "2px solid rgba(255,255,255,0.1)",
                background: !homeWins
                  ? "rgba(249,115,22,0.08)"
                  : "rgba(255,255,255,0.04)",
                boxShadow: !homeWins
                  ? "0 0 40px rgba(249,115,22,0.18)"
                  : "none",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img
                src={awayTeam.logoUrl}
                alt={awayTeam.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "32px",
                fontWeight: 800,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: !homeWins
                  ? "rgba(255,255,255,0.95)"
                  : "rgba(255,255,255,0.6)",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {awayTeam.name}
            </div>
            <div
              style={{
                fontFamily: BARLOW,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: !homeWins
                  ? "rgba(249,115,22,0.7)"
                  : "rgba(255,255,255,0.25)",
              }}
            >
              {!homeWins ? "AWAY · WINNER" : "AWAY"}
            </div>
          </div>
        </div>

        {/* ── FLEX SPACER (pushes players to bottom third) ── */}
        <div style={{ flex: 1 }} />

        {/* ── TOP PLAYERS — bottom third, side-by-side compact cards ── */}
        {(topPlayers.home || topPlayers.away) && (
          <div
            style={{
              display: "flex",
              gap: "24px",
              marginBottom: "48px",
            }}
          >
            {topPlayers.home && (
              <PlayerCard player={topPlayers.home} teamName={homeTeam.name} />
            )}
            {topPlayers.away && (
              <PlayerCard player={topPlayers.away} teamName={awayTeam.name} />
            )}
          </div>
        )}

        {/* ── METADATA — single line ── */}
        <div
          style={{
            fontFamily: BARLOW,
            fontSize: "18px",
            fontWeight: 600,
            letterSpacing: "1.5px",
            color: "rgba(255,255,255,0.7)",
            textAlign: "center",
          }}
        >
          {date} · {venue} · Season {season}
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
  topPlayers,
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
        width: 1080,
        height: 1920,
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#0B0F1A",
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
            topPlayers={topPlayers}
          />
        </div>
      </div>
    </>
  );
}
