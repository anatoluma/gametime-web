import { createClient } from "@supabase/supabase-js";
import { TEAM_CODE_MAP } from "@/lib/team-codes";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type TeamRow = {
  team_id: string;
  team_name: string | null;
};

export type TeamResolution = {
  extracted_code: string;
  resolved_id: string | null;
  confidence: number;
  method: "exact" | "fuzzy" | "unresolved";
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matchDist = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;

  let trans = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) trans++;
    k++;
  }

  const jaro = (matches / a.length + matches / b.length + (matches - trans / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    prefix++;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function bestScore(extracted: string, team: TeamRow): number {
  const norm = normalize(extracted);
  const candidates = [
    normalize(team.team_id),
    team.team_name ? normalize(team.team_name) : "",
    // first 3 chars of team name — catches abbreviation-style codes
    team.team_name ? normalize(team.team_name).slice(0, 3) : "",
  ].filter(Boolean);

  return candidates.reduce((best, c) => Math.max(best, jaroWinkler(norm, c)), 0);
}

/**
 * Resolve extracted team codes against the DB teams table.
 * Uses TEAM_CODE_MAP first (exact alias lookup), then falls back to fuzzy
 * matching against team_id and team name.
 */
export async function resolveTeamCodes(
  extractedCodes: string[]
): Promise<TeamResolution[]> {
  const { data, error } = await supabaseAdmin
    .from("teams")
    .select("team_id, team_name");

  if (error) throw new Error(`Failed to load teams: ${error.message}`);
  const teams = (data ?? []) as TeamRow[];

  return extractedCodes.map((raw) => {
    const upper = raw.trim().toUpperCase();

    // 1. Exact alias lookup (team-codes.ts)
    const mapped = TEAM_CODE_MAP[upper];
    if (mapped) {
      return { extracted_code: raw, resolved_id: mapped, confidence: 1, method: "exact" };
    }

    // 2. Direct match against a known team_id
    if (teams.some((t) => t.team_id.toUpperCase() === upper)) {
      return { extracted_code: raw, resolved_id: upper, confidence: 1, method: "exact" };
    }

    // 3. Fuzzy match against team_id and name
    const scored = teams
      .map((t) => ({ team: t, score: bestScore(raw, t) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best && best.score >= 0.72) {
      return {
        extracted_code: raw,
        resolved_id: best.team.team_id,
        confidence: Number(best.score.toFixed(3)),
        method: "fuzzy",
      };
    }

    return { extracted_code: raw, resolved_id: null, confidence: 0, method: "unresolved" };
  });
}
