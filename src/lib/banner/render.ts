import React from "react";
import type { ImageResponse } from "next/og";
import type { BannerContent, BannerTeam } from "./types";

export const BANNER_WIDTH = 1600;
export const BANNER_HEIGHT = 600;

type Font = { name: string; data: Buffer | ArrayBuffer; weight: 600 | 700 | 800; style: "normal" };

const NAVY_950 = "#0a1220";
const NAVY_900 = "#0e1930";
const ORANGE = "#ff7a1a";
const FONT = "Barlow Condensed";

const h = React.createElement;

// Essentials (logos, score, names, headline) stay inside the central 800px so a
// 4:3 mobile crop (object-cover on the 1600x600 image) keeps them intact.
const LOGO_SIZE = 150;
const SIDE_COL = 220;
const SCORE_SIZE = 150;
const SCORE_COL = 360;

function logo(team: BannerTeam) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        borderRadius: LOGO_SIZE,
        background: "#ffffff",
        border: `6px solid ${ORANGE}`,
        overflow: "hidden",
      },
    },
    team.logo
      ? h("img", { src: team.logo, width: LOGO_SIZE - 12, height: LOGO_SIZE - 12, style: { objectFit: "cover" } })
      : h("div", { style: { display: "flex", fontSize: 64, fontWeight: 800, color: NAVY_950 } }, team.code)
  );
}

function teamColumn(team: BannerTeam) {
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", alignItems: "center", width: SIDE_COL } },
    logo(team),
    h(
      "div",
      {
        style: {
          display: "flex",
          marginTop: 14,
          fontSize: 42,
          fontWeight: 700,
          lineHeight: 1,
          color: "#ffffff",
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: 1,
          height: 86,
          alignItems: "flex-start",
          justifyContent: "center",
        },
      },
      team.name
    )
  );
}

function score(value: number, won: boolean) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        fontSize: SCORE_SIZE,
        fontWeight: 800,
        lineHeight: 1,
        color: won ? ORANGE : "rgba(255,255,255,0.78)",
        textShadow: "0 4px 18px rgba(0,0,0,0.7)",
      },
    },
    String(value)
  );
}

export function BannerTemplate({ content }: { content: BannerContent }) {
  const { home, away } = content;
  const winner = content.narrative === "winner" ? content.winner : "draw";

  const meta = [content.dateLabel, content.season].filter(Boolean);

  return h(
    "div",
    {
      style: {
        display: "flex",
        position: "relative",
        width: BANNER_WIDTH,
        height: BANNER_HEIGHT,
        background: `linear-gradient(115deg, #05080f 0%, ${NAVY_900} 55%, #142140 100%)`,
        fontFamily: FONT,
      },
    },
    content.photo
      ? h("img", {
          src: content.photo,
          width: BANNER_WIDTH,
          height: BANNER_HEIGHT,
          style: { position: "absolute", top: 0, left: 0, objectFit: "cover" },
        })
      : null,
    // Navy tint, then a darker centre so the score stays legible over any photo.
    h("div", {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: BANNER_WIDTH,
        height: BANNER_HEIGHT,
        background: content.photo
          ? "linear-gradient(180deg, rgba(5,8,15,0.55) 0%, rgba(10,18,32,0.35) 45%, rgba(5,8,15,0.85) 100%)"
          : "radial-gradient(ellipse at 50% 45%, rgba(255,122,26,0.18) 0%, rgba(255,122,26,0) 60%)",
      },
    }),
    content.photo
      ? h("div", {
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            width: BANNER_WIDTH,
            height: BANNER_HEIGHT,
            background:
              "radial-gradient(ellipse 640px 360px at 50% 48%, rgba(5,8,15,0.88) 0%, rgba(5,8,15,0) 100%)",
          },
        })
      : null,
    // Outer chrome: may be cropped away on mobile, nothing essential lives here.
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: 34,
          left: 48,
          display: "flex",
          alignItems: "center",
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 3,
          color: "#ffffff",
          textTransform: "uppercase",
        },
      },
      h("div", { style: { display: "flex", width: 8, height: 30, background: ORANGE, marginRight: 14 } }),
      "Liga Basket Moldova"
    ),
    h("div", {
      style: {
        position: "absolute",
        left: 0,
        bottom: 0,
        width: BANNER_WIDTH,
        height: 12,
        background: `linear-gradient(90deg, ${ORANGE} 0%, #ff9a4d 100%)`,
      },
    }),
    // Centred essentials.
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: BANNER_WIDTH,
          height: BANNER_HEIGHT,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 10,
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: 4,
            color: ORANGE,
            textTransform: "uppercase",
            marginBottom: 22,
          },
        },
        ["FINAL", ...meta].join("  ·  ")
      ),
      h(
        "div",
        { style: { display: "flex", alignItems: "flex-start", justifyContent: "center" } },
        teamColumn(home),
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: SCORE_COL,
              height: LOGO_SIZE,
            },
          },
          score(content.homeScore, winner === "home"),
          h("div", { style: { display: "flex", fontSize: 60, fontWeight: 700, color: "rgba(255,255,255,0.6)", margin: "0 22px" } }, "–"),
          score(content.awayScore, winner === "away")
        ),
        teamColumn(away)
      ),
      content.headline
        ? h(
            "div",
            {
              style: {
                display: "flex",
                marginTop: 4,
                maxWidth: 760,
                fontSize: 40,
                fontWeight: 600,
                lineHeight: 1.1,
                color: "#ffffff",
                textTransform: "uppercase",
                letterSpacing: 2,
                textAlign: "center",
                justifyContent: "center",
              },
            },
            content.headline
          )
        : null
    )
  );
}

/**
 * Renders the template to a 1600x600 PNG. Pure: fonts and images are passed in. The caller supplies
 * `ImageResponse` from "next/og", which plain Node ESM (the preview CLI) cannot resolve by itself.
 */
export async function renderBannerPng(
  content: BannerContent,
  fonts: Font[],
  ImageResponseCtor: typeof ImageResponse
): Promise<Buffer> {
  const response = new ImageResponseCtor(h(BannerTemplate, { content }), {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    fonts,
  });
  return Buffer.from(await response.arrayBuffer());
}
