import { readFile } from "node:fs/promises";
import path from "node:path";

export type BannerFont = {
  name: string;
  data: Buffer;
  weight: 600 | 700 | 800;
  style: "normal";
};

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

const FILES: Array<[string, BannerFont["weight"]]> = [
  ["BarlowCondensed-SemiBold.ttf", 600],
  ["BarlowCondensed-Bold.ttf", 700],
  ["BarlowCondensed-ExtraBold.ttf", 800],
];

/** Barlow Condensed is already the site's display face (see src/app/layout.tsx). */
export async function loadBannerFonts(): Promise<BannerFont[]> {
  return Promise.all(
    FILES.map(async ([file, weight]) => ({
      name: "Barlow Condensed",
      data: await readFile(path.join(FONT_DIR, file)),
      weight,
      style: "normal" as const,
    }))
  );
}
