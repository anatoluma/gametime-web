// Local-only banner preview: renders a real game to a PNG without any admin login.
//   npm run banner:preview -- --game g_2026_09_20_WOL_GTM [--headline "..."] [--photo file.jpg] [--no-photo] [--out file.png]
// Reads public game/team data with the anon key from .env.local; never uses the service-role key.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og.js";
import { buildBannerContent } from "../src/lib/banner/content.ts";
import { loadBannerFonts } from "../src/lib/banner/fonts.ts";
import { loadTeamLogo, preparePhoto } from "../src/lib/banner/images.ts";
import { renderBannerPng, BANNER_WIDTH, BANNER_HEIGHT } from "../src/lib/banner/render.ts";

if (process.env.NODE_ENV === "production") {
  console.error("banner:preview is a local development tool and refuses to run in production.");
  process.exit(1);
}

const root = process.cwd();
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    const i = t.indexOf("=");
    if (i > 0 && !t.startsWith("#")) env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, "");
  }
  return env;
}

function listLocalPhotos(teamId) {
  const dirName = fs.existsSync(path.join(root, "public/images/photos"))
    ? fs.readdirSync(path.join(root, "public/images/photos")).find((d) => d.toLowerCase() === teamId.toLowerCase())
    : null;
  if (!dirName) return [];
  const dir = path.join(root, "public/images/photos", dirName);
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => path.join(dir, f));
}

const gameId = option("game") ?? "g_2026_09_20_WOL_GTM";
const out = path.resolve(root, option("out") ?? path.join("tmp", "banner-previews", `${gameId}.png`));

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: game, error: gameError } = await supabase
  .from("games")
  .select("game_id, tipoff, season, home_team_id, away_team_id, home_score, away_score")
  .eq("game_id", gameId)
  .maybeSingle();
if (gameError || !game) throw new Error(`Game ${gameId} not found: ${gameError?.message ?? "no row"}`);
if (game.home_score == null || game.away_score == null) throw new Error(`Game ${gameId} has no final score`);

const { data: teams, error: teamsError } = await supabase
  .from("teams")
  .select("team_id, team_name, logo_url")
  .in("team_id", [game.home_team_id, game.away_team_id]);
if (teamsError) throw new Error(teamsError.message);
const team = (id) => teams.find((t) => t.team_id === id) ?? { team_id: id, team_name: id, logo_url: null };

const photosByTeam = flag("no-photo")
  ? {}
  : option("photo")
    ? { [game.home_team_id]: [path.resolve(root, option("photo"))], [game.away_team_id]: [] }
    : {
      [game.home_team_id]: listLocalPhotos(game.home_team_id),
      [game.away_team_id]: listLocalPhotos(game.away_team_id),
    };

const content = await buildBannerContent(game, {
  home: team(game.home_team_id),
  away: team(game.away_team_id),
  photosByTeam,
  headline: option("headline") ?? null,
  loadLogo: loadTeamLogo,
  loadPhoto: preparePhoto,
});

const png = await renderBannerPng(content, await loadBannerFonts(), ImageResponse);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);

console.log(`${content.home.name} ${content.homeScore}–${content.awayScore} ${content.away.name}`);
console.log(`Photo: ${content.photo ? "yes" : "no (branded gradient)"}`);
console.log(`Wrote ${out} (${BANNER_WIDTH}x${BANNER_HEIGHT}, ${(png.length / 1024).toFixed(0)} KB)`);
