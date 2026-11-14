import type { SupabaseClient } from "@supabase/supabase-js";
import type { RosterEntry } from "./commit-integrity.ts";
import { unregisteredReviewPlayers, type ReviewPlayer } from "./review-roster.ts";

type PlayerSeasonRow = {
  player_id: string;
  team_id: string;
  jersey_number: number | null;
  players:
    | { first_name: string | null; last_name: string | null }
    | { first_name: string | null; last_name: string | null }[]
    | null;
};

/** Active roster for a season, with canonical names from players. */
export async function fetchSeasonRoster(
  db: SupabaseClient,
  season: string,
  teamIds?: string[]
): Promise<RosterEntry[]> {
  const rows: PlayerSeasonRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = db
      .from("player_seasons")
      .select("player_id, team_id, jersey_number, players(first_name, last_name)")
      .eq("season", season)
      .eq("is_active", true)
      .order("player_id")
      .range(offset, offset + pageSize - 1);
    if (teamIds && teamIds.length > 0) query = query.in("team_id", teamIds);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load ${season} roster: ${error.message}`);
    const page = (data ?? []) as PlayerSeasonRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.map((row) => {
    const details = Array.isArray(row.players) ? row.players[0] : row.players;
    return {
      player_id: row.player_id,
      team_id: row.team_id,
      jersey_number: row.jersey_number,
      first_name: details?.first_name ?? null,
      last_name: details?.last_name ?? null,
    };
  });
}

export async function fetchUnregisteredReviewPlayers(
  db: SupabaseClient,
  season: string,
  teamIds: string[]
): Promise<ReviewPlayer[]> {
  if (teamIds.length === 0) return [];

  const players: ReviewPlayer[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("players")
      .select("player_id, team_id, first_name, last_name, jersey_number")
      .in("team_id", teamIds)
      .order("player_id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Failed to load existing team players: ${error.message}`);
    const page = (data ?? []) as ReviewPlayer[];
    players.push(...page);
    if (page.length < pageSize) break;
  }

  const registrations: { player_id: string }[] = [];
  for (let offset = 0; offset < players.length; offset += 200) {
    const ids = players.slice(offset, offset + 200).map((player) => player.player_id);
    const { data, error } = await db
      .from("player_seasons")
      .select("player_id")
      .eq("season", season)
      .in("player_id", ids);
    if (error) throw new Error(`Failed to check ${season} player registrations: ${error.message}`);
    registrations.push(...(data ?? []));
  }
  return unregisteredReviewPlayers(players, registrations);
}
