import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dataUri = (mime: string, buf: Buffer) => `data:${mime};base64,${buf.toString("base64")}`;

/** Scales proportionally to cover the banner, crops only the centred overflow, and recompresses. */
export async function preparePhoto(input: Buffer | string): Promise<string> {
  const jpeg = await sharp(input)
    .rotate()
    .resize(1600, 600, { fit: "cover", position: "centre" })
    .jpeg({ quality: 82 })
    .toBuffer();
  return dataUri("image/jpeg", jpeg);
}

/** Satori cannot decode WebP, so logos are always converted to PNG. */
export async function prepareLogo(input: Buffer): Promise<string> {
  const png = await sharp(input)
    .resize(240, 240, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  return dataUri("image/png", png);
}

function findLocalTeamLogo(teamId: string): Buffer | null {
  const dir = path.join(process.cwd(), "public", "images", "teams");
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((f) => f.toLowerCase() === `${teamId}.webp`.toLowerCase());
  return hit ? fs.readFileSync(path.join(dir, hit)) : null;
}

/** Uploaded team logo first, then the bundled public/images/teams file; null if neither exists. */
export async function loadTeamLogo(team: { team_id: string; logo_url: string | null }): Promise<string | null> {
  let input: Buffer | null = null;

  if (team.logo_url) {
    const res = await fetch(team.logo_url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (res?.ok) input = Buffer.from(await res.arrayBuffer());
  }
  input ??= findLocalTeamLogo(team.team_id);

  return input ? prepareLogo(input).catch(() => null) : null;
}
