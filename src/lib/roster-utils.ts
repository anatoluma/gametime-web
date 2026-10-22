// Pure helpers shared by name-resolution, commit and the integrity check.
// Relative imports use the .ts extension so node --test can load this module directly.
import { resolveTeamId } from "./team-codes.ts";

/** Jersey numbers arrive as numbers or strings ("7", "#7", " 07 "). Returns null when absent or invalid. */
export function normalizeJerseyNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 && value <= 999 ? value : null;
  }
  if (typeof value === "string") {
    const match = value.trim().replace(/^#/, "").match(/^\d{1,3}$/);
    return match ? Number.parseInt(match[0], 10) : null;
  }
  return null;
}

/** Accent/case/punctuation-insensitive name key. */
export function normalizeNameKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function normalizeTeamKey(code: unknown): string | null {
  if (typeof code !== "string" || code.trim() === "") return null;
  return resolveTeamId(code) ?? code.trim().toUpperCase();
}

/** Stable key for a box-score row: team | jersey | name. */
export function resolutionKey(teamCode: unknown, number: unknown, name: unknown): string {
  return `${normalizeTeamKey(teamCode) ?? ""}|${normalizeJerseyNumber(number) ?? ""}|${normalizeNameKey(name)}`;
}

/** Season label ("2026/27") for a YYYY-MM-DD date or ISO timestamp; seasons start in August. */
export function seasonFromDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

export type ResolutionItemLike = {
  team_code?: string | null;
  number?: unknown;
  extracted_name?: string | null;
  resolved_player_id?: string | number | null;
};

export type ResolutionLookup =
  | { status: "found"; item: ResolutionItemLike; playerId: string | null; legacy: boolean }
  | { status: "ambiguous"; items: ResolutionItemLike[] }
  | { status: "none" };

/**
 * Finds the stored resolution for one extracted row.
 * Exact match on team + normalized jersey + name wins. Legacy jobs saved number = null
 * (string jersey numbers were dropped), so those are matched by team + name only,
 * and only when the match is unique; otherwise the caller must request manual resolution.
 */
export function findResolution(
  items: ResolutionItemLike[],
  teamCode: unknown,
  number: unknown,
  name: unknown
): ResolutionLookup {
  const team = normalizeTeamKey(teamCode);
  const nameKey = normalizeNameKey(name);
  const jersey = normalizeJerseyNumber(number);

  const sameNameAndTeam = items.filter(
    (item) => normalizeTeamKey(item.team_code) === team && normalizeNameKey(item.extracted_name) === nameKey
  );
  if (sameNameAndTeam.length === 0) return { status: "none" };

  let pool = sameNameAndTeam;
  let legacy = false;
  if (jersey !== null) {
    const exact = sameNameAndTeam.filter((item) => normalizeJerseyNumber(item.number) === jersey);
    if (exact.length > 0) {
      pool = exact;
    } else {
      pool = sameNameAndTeam.filter((item) => normalizeJerseyNumber(item.number) === null);
      legacy = true;
    }
  }
  if (pool.length === 0) return { status: "none" };

  const ids = new Set(
    pool.map((item) =>
      item.resolved_player_id === undefined || item.resolved_player_id === null || item.resolved_player_id === ""
        ? ""
        : String(item.resolved_player_id)
    )
  );
  if (ids.size > 1) return { status: "ambiguous", items: pool };

  const [id] = [...ids];
  return { status: "found", item: pool[0], playerId: id === "" ? null : id, legacy };
}
