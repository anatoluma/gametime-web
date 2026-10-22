import sharp from "sharp";
import { getTeamLogoUrl } from "../team-logo.ts";

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

/** Fetches the team logo from the authoritative bucket (see team-logo.ts); null when missing, so the placeholder renders. */
export async function loadTeamLogo(team: { team_id: string }): Promise<string | null> {
  const url = getTeamLogoUrl(team.team_id);
  if (!url) return null;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return null;

  return prepareLogo(Buffer.from(await res.arrayBuffer())).catch(() => null);
}