/**
 * Normalize the raw extraction JSON from Claude into the canonical schema.
 *
 * Different FIBA box score software versions use different column abbreviations
 * and Claude sometimes mirrors those instead of following the prompt schema.
 * This layer tolerates both flat player objects and nested stats objects, and
 * maps every known field alias to the canonical name before validation runs.
 */

// Map any abbreviation Claude might use → canonical stat field name
const STAT_ALIASES: Record<string, string> = {
  // Field goals
  fgm: "fg_made", fg_m: "fg_made", "fg-made": "fg_made",
  fga: "fg_att",  fg_a: "fg_att",  "fg-att":  "fg_att",
  // 2-pointers
  "2pm": "two_made", "2m": "two_made", two_m: "two_made", twom: "two_made",
  "2pa": "two_att",  "2a": "two_att",  two_a: "two_att",  twoa: "two_att",
  "2pts_m": "two_made", "2pts_a": "two_att",
  // 3-pointers
  "3pm": "three_made", "3m": "three_made", three_m: "three_made", threem: "three_made",
  "3pa": "three_att",  "3a": "three_att",  three_a: "three_att",  threea: "three_att",
  "3pts_m": "three_made", "3pts_a": "three_att",
  // Free throws
  ftm: "ft_made", ft_m: "ft_made",
  fta: "ft_att",  ft_a: "ft_att",
  // Rebounds
  or:      "reb_off", off_reb: "reb_off", reb_o: "reb_off", o_reb: "reb_off",
  dr:      "reb_def", def_reb: "reb_def", reb_d: "reb_def", d_reb: "reb_def",
  tot:     "reb_tot", reb:     "reb_tot", total_reb: "reb_tot",
  // Other box score stats
  ast:     "assists",  as: "assists",
  to:      "turnovers", tov: "turnovers",
  stl:     "steals",   st:  "steals",
  blk:     "blocks",   bs:  "blocks",   bk: "blocks",
  pf:      "fouls_personal", fouls: "fouls_personal",
  fd:      "fouls_drawn",
  pm:      "plus_minus",
  ef:      "efficiency", eff: "efficiency",
  pts:     "points",   pt: "points",
};

// Canonical stat field names (as defined in the prompt schema)
const CANONICAL_STATS = new Set([
  "min",
  "fg_made", "fg_att",
  "two_made", "two_att",
  "three_made", "three_att",
  "ft_made", "ft_att",
  "reb_off", "reb_def", "reb_tot",
  "assists", "turnovers", "steals", "blocks",
  "fouls_personal", "fouls_drawn",
  "plus_minus", "efficiency", "points",
]);

// Percentage / computed fields that should be discarded (they're derived from made/att)
const DISCARD_FIELDS = new Set([
  "fg_pct", "two_pct", "three_pct", "ft_pct", "pct",
  "fg_perc", "2_pct", "3_pct",
]);

// Player-level field aliases (everything outside the stats box)
const PLAYER_FIELD_ALIASES: Record<string, string> = {
  team:    "team_code",
  team_id: "team_code",
  no:      "number",
  num:     "number",
  jersey:  "number",
  "#":     "number",
  cap:     "captain",
  is_captain: "captain",
  is_starter: "starter",
};

const CANONICAL_PLAYER_FIELDS = new Set([
  "team_code", "number", "name", "starter", "captain", "dnp", "stats",
]);

function resolveStatKey(raw: string): string | null {
  const lower = raw.toLowerCase().replace(/[-\s]/g, "_");
  if (CANONICAL_STATS.has(lower))  return lower;
  if (STAT_ALIASES[lower])         return STAT_ALIASES[lower];
  return null;
}

function normalizeStats(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (DISCARD_FIELDS.has(k.toLowerCase())) continue;
    const canonical = resolveStatKey(k);
    if (canonical) out[canonical] = v;
  }
  return out;
}

function normalizePlayer(raw: Record<string, unknown>): Record<string, unknown> {
  const player: Record<string, unknown> = {};
  const flatStats: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(raw)) {
    const lower = k.toLowerCase();

    // Skip percentage fields
    if (DISCARD_FIELDS.has(lower)) continue;

    // Player-level alias → canonical player field
    const playerAlias = PLAYER_FIELD_ALIASES[lower];
    if (playerAlias) {
      player[playerAlias] = v;
      continue;
    }

    // Already a canonical player field (name, number, dnp, starter, captain, team_code)
    if (CANONICAL_PLAYER_FIELDS.has(lower) && lower !== "stats") {
      player[lower] = v;
      continue;
    }

    // Nested stats object
    if (lower === "stats" && v !== null && typeof v === "object" && !Array.isArray(v)) {
      const nested = normalizeStats(v as Record<string, unknown>);
      Object.assign(flatStats, nested);
      continue;
    }

    // Stat field at top level (flat structure)
    const canonical = resolveStatKey(k);
    if (canonical) {
      flatStats[canonical] = v;
      continue;
    }

    // Unknown field — preserve it so nothing is silently lost
    player[k] = v;
  }

  player.stats = flatStats;
  return player;
}

export function normalizeExtractionJson(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...raw };

  if (Array.isArray(raw.players)) {
    out.players = raw.players.map((p) =>
      p !== null && typeof p === "object" && !Array.isArray(p)
        ? normalizePlayer(p as Record<string, unknown>)
        : p
    );
  }

  // team_totals uses the same flat stat structure
  if (Array.isArray(raw.team_totals)) {
    out.team_totals = raw.team_totals.map((t) => {
      if (t === null || typeof t !== "object" || Array.isArray(t)) return t;
      const row = t as Record<string, unknown>;
      const stats =
        row.stats !== null && typeof row.stats === "object" && !Array.isArray(row.stats)
          ? normalizeStats(row.stats as Record<string, unknown>)
          : normalizeStats(row);
      return { team_code: row.team_code ?? row.team ?? row.team_id, stats };
    });
  }

  return out;
}
